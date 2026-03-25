import {useState, useEffect, useMemo} from 'react'
import { Routes, Route, Outlet, useOutletContext, useParams, Link, useNavigate } from "react-router-dom"

import {getLoggedState, getGlobalUniqueCode} from 'azlib/common.mjs' 

import {later} from 'azlib/helpers.mjs'

import {useLocalState} from 'azlib/local-db-item.mjs'

import {sha256}  from  'js-sha256';

import {confirm} from 'azlib/components/controls.jsx'

import qs from '../data/quests.mjs';



export default function TrPage() {
	return <Routes>
		<Route element={<TrLayout/>}>
			<Route index element={<TrIndex/>} />
			<Route path=":id" element={<TrChild/>} />
			<Route path=":id/test/:step" element={<TrTest/>} />
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
			await later(100)
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
				child.tests
				.map((t,i)=><div key={i}>
					<div><Link to={`test/${i+1}`}>№ {+i+1} {t.trMeta?.info}</Link></div>
				</div>)
			|| '-нет-'
			}
			<div>
			<button type="button" onClick={async ()=>{
				setTests(draft=>[...(draft??[]), {
					meta: {
						notes: ''
						, levels: allLevels
						, period: ''
					}
					, trMeta: {
						info: ''
						, clPass: sha256.hmac(id, login)
					}
					, tr: {}
				}])
				await later(100)
				navigate(`test/${tests.length+1}`)
			}}>+ Еще тест</button>
			</div>
		</>}
	</section>
}

function TrTest() {
	const navigate = useNavigate()
	const {id, step} = useParams()
	const idx = +step-1;
	const {index} = useOutletContext()
	const child = index.children[id]
	const [hasTests, tests, produceTests] = useLocalState(`tr-tests-${id}`,[])
	const test = tests?.[idx]
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
			<div>
				<button type="button"
					onClick={()=>{
						navigate('perform/tr')
					}} 
					>Заполнить ответы терапевта</button>
				<button type="button" >Отправить клиенту</button>
				<button type="button" 
					onClick={()=>{
						if(!confirm('и правда удалить')) return;
						//produceTests(draft=>{
							// draft.splice(idx,1)
						// })
					}}
				>Удалить</button>
			</div>
		</>}
	</section>
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