import {useState, useEffect, useMemo, useCallback} from 'react'
import { Routes, Route, Outlet, useOutletContext, useParams, Link, useNavigate } from "react-router-dom"

import {getLoggedState, getGlobalUniqueCode, customStore} from 'azlib/common.mjs' 

import {useLocalState, syncSave} from 'azlib/local-db-item.mjs'

import {sha256}  from  'js-sha256';

import {set as setKV} from 'idb-keyval';

import {confirm} from 'azlib/components/controls.jsx'

import QInput from '../cmn/questions-input.jsx';

import qs from '../data/quests.mjs';



export default function TrPage() {
	return <Routes>
		<Route element={<TrLayout/>}>
			<Route index element={<TrIndex/>} />
			<Route path=":id">
				<Route index element={<TrChild/>} />
				<Route path="test/:step/:bid" element={<TrTest/>} />
				<Route path="test/:step/:bid/perform/tr" element={<TrPerformTest mode="tr" />} />
				<Route path="test/:step/:bid/perform/cl" element={<TrPerformTest mode="cl" />} />
			</Route>
		</Route>
	</Routes>
}

function TrLayout() {
	const [auth, setAuth] = useState()
	useEffect(()=>{
		if(auth) return;
		getLoggedState().then(setAuth) 
	}, [auth, setAuth])

	const login = auth?.uinfo?.login

	const [hasIndex, index, produceIndex] = 
		useLocalState(`index-${login}`
		, {}
		, !auth
		)


	const ctx = useMemo(()=>({index,produceIndex,login}), [index,produceIndex,login])

	return 	auth && hasIndex 
		&& <Outlet context={ctx} />
	|| <div>--- wait ---</div>	
}

function TrIndex() {
	const {index, produceIndex} = useOutletContext()
	const children = Object.values(index?.children??{})
	const navigate = useNavigate()
	return <section>
		<h1>Дети</h1>
		{children.length &&	
			children
			.toSorted(cmp.selector.desc('lastOp'))
			.map(c=>
			<div key={c.id}>
				<Link to={c.id}>
					<div>{c.fio??'---'}</div>
					<div>{c.bday}</div>
				</Link>
			</div>) 
		||'нет'}
		<div>
		<button type="button" onClick={async ()=>{
			const id = (await getGlobalUniqueCode()).replace(/[.]/g,'~')
			produceIndex(draft=>{
				draft.children ??= {}
				draft.children[id] = {id, lastOp: Date.now()}
			})
			navigate(`/tr/${id}`)
		}}>+ новый ребенок</button>
		</div>
	</section>
}

const allLevels = Object.keys(qs)

function TrChild() {
	const navigate = useNavigate()
	const {id} = useParams()
	const {index, produceIndex, login} = useOutletContext()
	const child = index.children[id]
	const [hasTests, tests, setTests] = useLocalState(`tr-tests-${id}`,[])

	return <section>
		<h1>Meta</h1>
		ФИО
		<input value={child.fio} onChange={e=>
				produceIndex(draft=>{
						draft.children[id].fio = e.target.value;
						draft.children[id].lastOp = Date.now();
					})
			}/>
		{!hasTests && '--- wait ---'}
		{hasTests && <> 
			<h1>Тесты</h1>
			{tests?.length &&
				tests
				.map((t,i)=><div key={i}>
					<div><Link to={`test/${i+1}/${t.meta.bookId}`}>№ {+i+1} {t.trMeta?.info}</Link></div>
				</div>)
			|| '-нет-'
			}
			<div>
			<button type="button" onClick={async ()=>{
				const bookId = getGlobalUniqueCode().replace(/[.]/g,'~')
				setTests(draft=>[...(draft??[]), {
					meta: {
						notes: ''
						, levels: allLevels
						, period: ''
						, bookId 
					}
					, trMeta: {
						info: ''
					}
					, tr: {}
				}])
				navigate(`test/${tests.length+1}/${bookId}`)
			}}>+ Еще тест</button>
			</div>
		</>}
	</section>
}

function TrTest() {
	const navigate = useNavigate()
	const {id, step, bid} = useParams()
	const idx = +step-1;
	const {index,login} = useOutletContext()
	const child = index.children[id]
	const [hasTests, tests, produceTests] = useLocalState(`tr-tests-${id}`,[])
	const test = tests?.[idx]
	if(hasTests && test?.meta?.bookId !== bid) {
		return "--- deleted ---"
	}
	if(!test) return;
	return <section>
		<h1>{child.fio}</h1>
		{!hasTests && '--- wait ---'}
		{hasTests && <>
			<h2>№ {step}</h2>
			Доп. инфо
			<input value={test.trMeta.info} onChange={e=>{
				produceTests(draft=>{
					draft[idx].trMeta.info = e.target.value
				})
			}}/>
			<hr/>
			<div>
				Указания:
				<textarea value={test.meta.notes} onChange={e=>{
					produceTests(draft=>{
						draft[idx].meta.notes = e.target.value
					})					
				}}/>
			</div>
			<div>
				Нужные уровни
				{
					allLevels.map((l,i)=><span key={l}>
						[<input type="checkbox" checked={l.in(...test.meta.levels)}
							onChange={e=>{
								produceTests(draft=>{
									if(e.target.checked) draft[idx].meta.levels
										= [...draft[idx].meta.levels, l]
									else draft[idx].meta.levels 
										= draft[idx].meta.levels.filter(x=>x!==l)
								})
							}}
						/>{i+1}]
					</span>)
				}
			</div>
			<hr/>
			<div>
				<button type="button"
					onClick={()=>{
						navigate('perform/tr')
					}} 
					>Заполнить ответы терапевта</button>
				<button type="button"
					onClick={()=>{
						navigate('perform/cl')
					}} 
					>Заполнить ответы за клиента</button>
				<button type="button" 
					onClick={()=>{sendToClient(test,id,login)}}
				>Отправить клиенту (пока тестовый вариант - себе!)</button>
				<button type="button" 
					onClick={async ()=>{
						if(!await confirm('и правда удалить')) return;
						await produceTests(draft=>{
							draft.splice(idx,1)
						})
						navigate(`/tr/${id}`,{replace:true})
					}}
				>Удалить</button>
			</div>
		</>}
	</section>
}

function TrPerformTest({mode}) {
	const {id, step, bid} = useParams()
	const idx = +step-1;
	const {index} = useOutletContext()
	const [hasTests, tests, produceTests] = useLocalState(`tr-tests-${id}`,[])
	const test = tests?.[idx]

	const valSetter = useCallback((q, v) => produceTests(draft=>{
		draft[idx][mode] ??= {}
		draft[idx][mode][q.lvl] ??= {}
		draft[idx][mode][q.lvl][q.part] ??= {}
		draft[idx][mode][q.lvl][q.part][q.npp] = v 						
	}),[mode, idx, produceTests])

	if(hasTests && test?.meta?.bookId !== bid) {
		return "--- deleted ---"
	}

	return <section>
		{!test && '--- wait ---'}
		{test && <QInput meta={test?.meta} value={test[mode]}  valSetter={valSetter} />}
	</section>

}

async function sendToClient(test, clId, login) {
	const pass = sha256.hmac(clId, login)
	const url = new URL(`/cl/${test.meta.bookId}#${pass}`, window.location.href)
	console.log(url)
	//MOCK
	await copyTextToClipboard(url.toString())
	await setKV(`to-cl-book-${test.meta.bookId}`, test, await customStore())
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    console.log('Text successfully copied to clipboard');
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
}


/*
	варианты хранения
	1) все-все храним в индексе
	2) в индексе храним список клиентов, а каждого клиента храним отдельно
		tr-client-id

	если все в индексе, в т.ч. шаги, размер его будет 10к на шаг - не много, но не красиво
	если в индексе клиенты, но не шаги, все более-менее

	шаги - набор тестов
	или все вместе
	или отдельно каждый
	все для терапевта проще?

	где-то нужен экспорт теста для клиента - отдельный код с отдельным шифром
	(шифр храним в тесте!)

	pass id теста + id терапевта
*/

/*
	клиент может вернуть результаты, послав их на сервер (нужен сервер)
	клиент также может вернуть их виде файла
	или вернуть в виде ссылки (но надо уложиться в 2K)
	у нас 500 вопросов максимум
	или отправить на почту
	или приложить файл автоматически - поделиться
*/