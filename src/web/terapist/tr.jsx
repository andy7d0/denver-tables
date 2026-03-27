import {useState, useEffect, useMemo, useCallback} from 'react'
import { Routes, Route, Outlet, useOutletContext, useParams, Link, useNavigate } from "react-router-dom"

import * as XLSX from 'xlsx-js-style'
import * as ExcelJS from 'exceljs' 

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

async function getExcel(child, tests){
		const rates = {}
		for(const lvl in qs) {
			rates[lvl] ??= {}
			for(const part in qs[lvl]) {
				rates[lvl][part] ??= {}
				const obj = qs[lvl][part]
				for(const maybeQ in obj) {
					if(maybeQ.match(/^\d/)) {
						rates[lvl][part][+maybeQ] =
							tests.map(t=>calc4col(t.tr?.[lvl]?.[part]?.[maybeQ], t.cl?.[lvl]?.[part]?.[maybeQ]))
					} else {
						for(const q in obj[maybeQ]) {
							rates[lvl][part][+q] =
								tests.map(t=>calc4col(t.tr?.[lvl]?.[part]?.[+q], t.cl?.[lvl]?.[part]?.[+q]))
						}
					}
				}
			}
		}
		for(const lvl in qs) {
			let lvl_sum = new Array(tests.length).fill(0);
			for(const part in qs[lvl]) {
				let part_sum
				for(const maybeQ in qs[lvl][part]) {
					if(maybeQ.match(/^\d/)) {
						part_sum ??= new Array(tests.length).fill(0);
						for(let i = 0; i< tests.length; ++i){
							part_sum[i] += rates[lvl][part][+maybeQ][i] ?? 0;
							lvl_sum[i] += rates[lvl][part][+maybeQ][i] ?? 0;
						}
					} else {
						part_sum ??= {};
						part_sum[maybeQ] ??= new Array(tests.length).fill(0);
						for(const q in qs[lvl][part][maybeQ]) {
							for(let i = 0; i< tests.length; ++i){
								part_sum[maybeQ][i] += rates[lvl][part][+q][i] ?? 0;
								lvl_sum[i] += rates[lvl][part][+q][i] ?? 0;
							}
						}
					}					
				}
				rates[lvl][part].$ = part_sum;
			}
			rates[lvl].$ = lvl_sum;
		}
		// console.log(rates)
		// return;


		const wb = new ExcelJS.Workbook();
		const ws = wb.addWorksheet('тесты');

		ws.columns = [
			{width: 4}, {width: 60},
			, ...tests.map(()=>[{width: 15}, {width: 15}, {width: 15}, {width: 15}])
		].flat();

		let rn = 1;
		let row = ws.addRow(['',`ФИ ребёнка: ${child.fio}`, 'Терапист, проводящий оценку:'])
		row.getCell(2).font = {bold: true}
		row.getCell(3).font = {bold: true}
		ws.mergeCells(1,3,1,100)

		row = ws.addRow([
						'', ''
			, ...tests.map((_,i)=>[`Тест ${i+1}`,'','',''])
		].flat()); ++rn;
		for(let i = 0; i<tests.length; ++i){
			row.getCell(1+2+i*4).alignment = {horizontal: 'center'};
			row.getCell(1+2+i*4).border = {bottom:{style:'thick'}};
			ws.mergeCells(rn, 1+2+i*4, rn, 1+2+i*4+3)
		}

		row = ws.addRow([
			'', ''
			, ...tests.map(()=>['Наблюдения','Информация от родителей','Общая оценка','Сумма'])
		].flat()); ++rn;
		for(let i = 0; i<tests.length; ++i){
			row.getCell(1+2+i*4).alignment = {horizontal: 'center', wrapText:true};
			row.getCell(1+2+i*4+1).alignment = {horizontal: 'center', wrapText:true};
			row.getCell(1+2+i*4+2).alignment = {horizontal: 'center', wrapText:true};
			row.getCell(1+2+i*4+3).alignment = {horizontal: 'center', wrapText:true};
		}

		for(const lvl in qs) {
			row = ws.addRow([
				'', lvl
				, ...rates[lvl].$.map(r=>['','','', r])
			].flat()); ++rn;
			row.getCell(2).fill = {type: 'pattern', pattern: 'solid'
					, fgColor: {argb: hcolors[lvl] ?? "AAAAAA"}}
			for(let i = 0; i<tests.length; ++i){
				row.getCell(1+2+i*4+3).fill = {type: 'pattern', pattern: 'solid'
					, fgColor: {argb: hcolors[lvl] ?? "AAAAAA"}}
			}

			for(const part in qs[lvl]) {
				row = ws.addRow([
					'', part
					, ...(rates[lvl][part].$.length ?
								rates[lvl].$.map(r=>['','','', r])
								: [])
				].flat()); ++rn;
				if(rates[lvl][part].$.length) {
					for(let i = 0; i<tests.length; ++i){
						row.getCell(1+2+i*4+3).fill = {type: 'pattern', pattern: 'solid'
							, fgColor: {argb: 'CCCCCC'}}
					}					
				}

				const obj = qs[lvl][part]
				for(const maybeQ in obj) {
					if(maybeQ.match(/^\d/)) {
						// simple quest
						row = ws.addRow([
							+maybeQ, obj[maybeQ].h
							, ...tests.map(t=>calcCols(
									t.tr?.[lvl]?.[part]?.[maybeQ]
									, t.cl?.[lvl]?.[part]?.[maybeQ]
									))
						].flat()); ++rn;
						row.getCell(2).alignment = {wrapText:true}
					} else {
						row = ws.addRow([
							'', maybeQ[0] === '.' ? maybeQ.slice(1) : maybeQ
							, ...rates[lvl][part].$[maybeQ].map(r=>['','','', r])
						].flat()); ++rn;
						for(let i = 0; i<tests.length; ++i){
							row.getCell(1+2+i*4+3).fill = {type: 'pattern', pattern: 'solid'
								, fgColor: {argb: 'CCCCCC'}}
						}					
						for(const q in obj[maybeQ]) {
							row = ws.addRow([
								+q, obj[maybeQ][q].h
								, ...tests.map(t=>calcCols(
										t.tr?.[lvl]?.[part]?.[maybeQ]
										, t.cl?.[lvl]?.[part]?.[maybeQ]
										))
							].flat()); ++rn;
							row.getCell(2).alignment = {wrapText:true}
						}
					}
				}
			}
		}

		ws.views = [
		  {state: 'frozen', xSplit: 2, ySplit: 3, topLeftCell: 'C4', activeCell: 'C4'}
		];

		const buffer = await wb.xlsx.writeBuffer();
		const xlsBlob = new Blob([buffer], {
    	type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
 		});
		saveBlobToFile(xlsBlob, `${child.fio}.xlsx`);
		return;
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