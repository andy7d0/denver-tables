import {useState, useEffect, useMemo, useCallback} from 'react'
import { Routes, Route, Outlet, useOutletContext, useParams, Link, useNavigate } from "react-router-dom"

import * as XLSX from 'xlsx-js-style'

import {getLoggedState, getGlobalUniqueCode} from 'azlib/common.mjs' 

import {useLocalState} from 'azlib/local-db-item.mjs'

import {confirm} from 'azlib/components/controls.jsx'

import QInput from '../cmn/questions-input.jsx';

import {sendToClient, trRead} from '../cmn/exchange.mjs'

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
	const {index, produceIndex} = useOutletContext()
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
				const iv = window.crypto.getRandomValues(new Uint8Array(12));

				setTests(draft=>[...(draft??[]), {
					meta: {
						notes: ''
						, levels: allLevels
						, period: ''
						, bookId 
						, ivHex: iv.toHex()
					}
					, trMeta: {
						info: ''
					}
					, tr: {}
				}])
				navigate(`test/${tests.length+1}/${bookId}`)
			}}>+ Еще тест</button>
			</div>
			<div>
				<button type="button" onClick={()=>{
					getExcel(child, tests)
				}}>Получить эксель</button>
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
	
	const [clRead, setClRead] = useState()
	useEffect(()=>{
		if(!hasTests || !test || clRead) return;
		if(test.cl) return;
		trRead(`book-${test.meta.bookId}`, id, login, test.meta.ivHex)
		.then(cl=>
				produceTests(draft=>{
					draft[idx].cl = cl
				})
			)
		setClRead(true)
	},[setClRead, hasTests, test, idx, clRead, produceTests, login, id])
	
	if(hasTests && test?.meta?.bookId !== bid) {
		return "--- deleted ---"
	}
	
	if(!tests) return;

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
		{test && <QInput meta={test?.meta} value={test[mode]}  valSetter={valSetter} 
				lastPage={
					<div>
						<div type="button" 
								style={{position:"fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)"}}
						><Link to={`/tr/${id}/test/${step}/${bid}`}>ВСЕ</Link></div>
					</div>					
				}
		/>}
	</section>

}

const hcolors = {
	"УРОВЕНЬ 1": 'fbd9d7'
	, "УРОВЕНЬ 2": 'fef2cd'
	, "УРОВЕНЬ 3": 'd3f1db'
	, "УРОВЕНЬ 4": 'b3cefb'
}

function getExcel(child, tests){
		const data = [
				['', `ФИ ребёнка: ${child.fio}`, 	'Терапист, проводящий оценку:']
		]

		data.push([
			'', ''
			, ...tests.map((_t,i)=>[{v:`Тест ${i+1}`, t:'s', s:{border:{bottom:'thick'}, alignment: {horizontal: "center"}}}
						,'','',''])
		].flat())
		data.push([
			'', ''
			, ...tests.map(()=>[
					{v:'Наблюдения', t:'s', s: {alignment: {horizontal: "center", wrapText:true}}}
					,{v:'Информация от родителей', s: {alignment: {horizontal: "center", wrapText:true}}}
					,{v:'Общая оценка', s: {alignment: {horizontal: "center", wrapText:true}}}
					,{v:'Сумма', s: {alignment: {horizontal: "center", wrapText:true}}}
				])
		].flat())

		const headers = []

		for(const lvl in qs) {
			data.push(['', {v:lvl, t:'s'
											, s: {fill: {fgColor: {rgb: hcolors[lvl] ?? "AAAAAA"}}}} ]); 
				//headers.push(data.length-1);
			for(const part in qs[lvl]) {
				data.push(['',{v:part, t:'s', 
						s: {fill: {patternType:"solid", fgColor: {rgb:"CCCCCC"}}} }]); 
					headers.push(data.length-1);
				const obj = qs[lvl][part]
				for(const maybeQ in obj) {
					if(maybeQ.match(/^\d/)) {
						// simple quest
						data.push([
							+maybeQ, {v:obj[maybeQ].h, t:'s', s:{alignment: {wrapText:true}}}
							,...tests.map(t=>calcCols(
									t.tr?.[lvl]?.[part]?.[maybeQ]
									, t.cl?.[lvl]?.[part]?.[maybeQ]
									))
						].flat())
					} else {
						data.push(['', maybeQ[0] === '.' ? maybeQ.slice(1) : maybeQ]); headers.push(data.length-1);
						for(const q in obj[maybeQ]) {
							data.push([
								+q, {v:obj[maybeQ][q].h, t:'s', s:{alignment: {wrapText:true}}}
									,...tests.map(t=>calcCols(
										t.tr?.[lvl]?.[part]?.[q]
										, t.cl?.[lvl]?.[part]?.[q]
										))
								])
						}
					}
				}
			}
		}

		const workbook = XLSX.utils.book_new();
		const worksheet = XLSX.utils.aoa_to_sheet(data);
		worksheet['!cols'] = [{ wch: 2 }, { wch: 60 }
			, ...tests.map(()=>[{wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}])
		].flat();

		worksheet['!merges'] = [{s:{r:0, c:2}, e:{r:0, c:100}}];
		for(const h of headers) {
		 	worksheet['!merges'].push({s:{r:h, c:1}, e:{r:h, c:100}})
		}
		for(let i =0; i< tests.length; ++i) {
		 	worksheet['!merges'].push({s:{r:1, c:2+i}, e:{r:1, c:2+i+3}})			
		}

		worksheet["B1"].s = {font: {bold: true}}
		worksheet["C1"].s = {font: {bold: true}}

		//console.log(worksheet)

		XLSX.utils.book_append_sheet(workbook, worksheet, 'тесты');

		const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' });

    const blob = new Blob([s2ab(wbout)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    saveBlobToFile(blob, `${child.fio}.xlsx`);
}

function calcCols(tr,cl) {
	return [ tr, cl, calc3col(tr,cl), calc4col(tr,cl)]
}

function calc3col(D5, E5) {
	/*
		D5 - tr
		E5 - cl

		 9 = +/-
		10 = +
		11 = -
		12 = x

		=IFS(AND(D5=$AE$10,E5=$AE$10),"О"
				,AND(D5=$AE$11,E5=$AE$11),"Н",
				OR(AND(D5=$AE$10,E5=$AE$12),AND(D5=$AE$12,E5=$AE$10)),"О",

			OR(AND(D5=$AE$11,E5=$AE$12),AND(D5=$AE$12,E5=$AE$11)),"Н"
			,TRUE(),"Ч")
	*/

	return 	(
		D5 === '+'  && E5 === '+' && 'O'
		||
		D5 === '-' && E5 === '-' && 'Н'
		||
		D5 === '+' && E5 === 'x' && 'O'
		||
		D5 === 'x' && E5 === '+' && 'O'
		||
		D5 === '-' && E5 === 'x' && 'Н'
		||
		D5 === 'x' && E5 === '-' && 'Н'
		||
		'Ч'
		);
}

function calc4col(D5,E5){
	/*
	=AK5+AL5
	AK5:
	=IF(OR(E5=$AE$12,E5=""),
	IFS(D5=$AE$9,0.5,D5=$AE$10,1,D5=$AE$11,0,D5=$AE$12,0,D5="",0),IFS(D5=$AE$9,0.25,D5=$AE$10,0.5,D5=$AE$11,0,D5=$AE$12,0,D5="",0))
	AL5:
	=IF(OR(D5=$AE$12,D5="")
	,IFS(E5=$AE$9,0.5,E5=$AE$10,1,E5=$AE$11,0,E5=$AE$12,0,E5="",0),IFS(E5=$AE$9,0.25,E5=$AE$10,0.5,E5=$AE$11,0,E5=$AE$12,0,E5="",0))
	*/
	const AK5 = (
		E5==='x' || !E5?
			( D5==='+/-' && 0.5
				||
				D5==='+' && 1
				||
				0
				)
		:
			(
				D5==='+/-' && 0.25
				||
				D5==='+' && 0.5
				||
				0 
				)
		);
	const AL5 = (
		D5==='x' || !D5?
			( E5==='+/-' && 0.5
				||
				E5==='+' && 1
				||
				0
				)
		:
			(
				E5==='+/-' && 0.25
				||
				E5==='+' && 0.5
				||
				0 
				)
		);
	return AK5+AL5;
}

function s2ab(s) {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
    return buf;
}


function saveBlobToFile(blob, fileName) {
  // Create a URL for the blob object
  const blobUrl = URL.createObjectURL(blob);

  // Create a temporary anchor element
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName; // Set the desired file name

  // Append link to body, click it, and remove it
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Free up memory by revoking the object URL
  // Delay revocation for Firefox compatibility
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 1000);
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