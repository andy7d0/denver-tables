import {useState, useEffect, useMemo, useCallback} from 'react'
import { Routes, Route, Outlet, useOutletContext, useParams, Link, useNavigate } from "react-router-dom"

import {setAuthToken, subscribe, broadcast, getLoggedState} from 'azlib/common.mjs'


import * as ExcelJS from 'exceljs' 

import {getGlobalUniqueCode} from 'azlib/common.mjs' 

import {useLocalState} from 'azlib/local-db-item.mjs'

import {confirm} from 'azlib/components/controls.jsx'

import QInput from '../cmn/questions-input.jsx';

import {tryLogin, registerLink, performRegister, sendToClient, trRead} from '../cmn/exchange.mjs'

import qs from '../data/quests.mjs';

// import {current} from 'immer'


export default function TrPage() {
	return <Routes>
		<Route element={<TrLayout/>}>
			<Route index element={<TrIndex/>} />
			<Route path=":id">
				<Route index element={<TrChild/>} />
				<Route path="test/new" element={<CreateTest/>} />
				<Route path="test/:step/:bid" element={<TrTest/>} />
				<Route path="test/:step/:bid/perform/tr" element={<TrPerformTest mode="tr" />} />
				<Route path="test/:step/:bid/perform/cl" element={<TrPerformTest mode="cl" />} />
			</Route>
		</Route>
	</Routes>
}

/* NOT USED!
const Uctx = createContext({})

const empty = {}

function UinfoContext({children}) {
  const [auth, setAuth] = useState()
  useEffect(()=>{
    const prev = subscribe('auth', setAuth)
    return () => subscribe('auth', prev)
  },[setAuth])
  useEffect(()=>{
    getLoggedState().then(st=>{broadcast('auth', st)})
  }, [])
  return <Uctx value={auth?.uinfo??empty}>{children}</Uctx>
}

export function useUinfo() {
  return useContext(Uctx);
}
*/

//{uinfo.login && <button onClick={()=>{logout(navigate)}}>logout</button>}


function TrLayout() {
	const [auth, setAuth] = useState()
  useEffect(()=>{
    const prev = subscribe('auth', setAuth)
    return () => subscribe('auth', prev)
  },[setAuth])
  useEffect(()=>{
    getLoggedState().then(st=>{broadcast('auth', st)})
  }, [])

	const login = auth?.uinfo?.login
	const ukey = auth?.uinfo?.ukey

	const [hasIndex, index, produceIndex] = useLocalState(`index`, {}, !auth)

	const ctx = useMemo(()=>({index,produceIndex,login,ukey}), [index,produceIndex,login,ukey])

	return 	!login && <main><LoginPage/></main>
		|| login && hasIndex 
		&& <Outlet context={ctx} />
		|| <div>--- wait ---</div>	
}

function LoginPage() {
	const [reg, setReg] = useState()
  const [err, setErr] = useState()
  const navigate = useNavigate()
  return <div style={{position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)"}}>
    {!reg && <form onSubmit={async (event)=> {
      event.preventDefault();
      setErr(null)
      const data = new FormData(event.target);
      const obj = Object.fromEntries(data.entries())
      try {
      	const login = data.get('login')
      	const ukey = await tryLogin(login, data.get('pass'))
        await setAuthToken({
          authorization: `Bearer: -:-`,
          uinfo: {login, ukey}
        });
      } catch(error) {
          console.log(error)
          //if(typeof error === 'string') setErr(error)
          setErr('неверное имя или пароль')        
      }
    }} >
    Login: <input name="login" />
    <br/>
    Pass: <input name="pass" type="password" />
    <br/>
    <button>Войти</button>
    <div style={{color:"red"}}>
    {err}
 		</div>
 		<button type="button" onClick={()=>{setErr(null); setReg(true)}}>Зарегистрироваться</button>
    </form>}
    {reg && <form
    onSubmit={async (event)=> {
      event.preventDefault();
      setErr(null)
      const data = new FormData(event.target);
      const obj = Object.fromEntries(data.entries())
      const login = data.get('login')
      const pass = data.get('pass')
      if(pass !== data.get('pass2')) {
      	setErr('Пароли не совпадают')
      	return;
      }
    	const link = await registerLink(login, pass)
    	window.open(link,'_blank')
    }}>
    Login: <input name="login" />
    <br/>
    Pass: <input name="pass" type="password" />
    <br/>
    Pass: <input name="pass2" type="password" />
    <br/>
    <button>Зарегистрироваться</button>
    <div style={{color:"red"}}>
    {err}
 		</div>
    </form>}
  </div>
}

export function TrRegister() {
	const {link} = useParams()
	const [st,setSt] = useState()
	useEffect(()=>{
		performRegister(link).then(setSt)
	}, [setSt,link])
	return st === undefined && <div>--- wait ---</div>
				|| st && <div>зарегистрировано! <Link to='/tr'>Войти</Link></div>
				|| <div>--- уже есть такой пользователь! <Link to='/tr'>Войти</Link></div>
}

function TrIndex() {
	const {index, produceIndex} = useOutletContext()
	const children = Object.values(index?.children??{})
	const navigate = useNavigate()
	return <main>
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
		<button type="button" onClick={()=>{setAuthToken(null); navigate('/')} }
				style={{position:"fixed", right:"1em", bottom:"1em"}}
			>Выйти</button>
	</main>
}

const allLevels = Object.keys(qs)

function TrChild() {
	const navigate = useNavigate()
	const {id} = useParams()
	const {index, produceIndex} = useOutletContext()
	const child = index.children[id]
	const [hasTests, tests] = useLocalState(`tr-tests-${id}`,[])

	if(!child) return '--- deleted ---'

	return <main>
		<nav>
		<Link to="/tr">Дети</Link>	
		</nav>	
	
		<h1>ФИО</h1>
		<input wide="" value={child.fio} onChange={e=>
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
					<div><Link to={`test/${i+1}/${t.meta.bookId}`}
						style={{fontWeight:(t.cl?'normal':'bold')}}
					>№ {+i+1} {t.trMeta?.info}</Link></div>
				</div>)
			|| '-нет-'
			}
			<br/>
			<div style={{display:"flex", flexDirection:"column", gap: 10}}>
			
				<button type="button" onClick={async ()=>{ navigate('test/new') }}>+ Еще тест</button>
				
				<button type="button" onClick={()=>{
						getExcel(child, tests)
					}}>Получить эксель</button>

				<button type="button" onClick={async ()=>{
						if(!await confirm(`и правда удалить всю информация о ${child.fio}`)) return;
						await produceIndex(draft=>{
							delete draft.children[id]
						})
						navigate(`/tr`,{replace:true})
				}}>Удалить ребенка и все его тесты</button>

			</div>
		</>}
	</main>
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
				cl && produceTests(draft=>{
					draft[idx].cl = cl
				})
			)
		setClRead(true)
	},[setClRead, hasTests, test, idx, clRead, produceTests, login, id])
	
	if(hasTests && test?.meta?.bookId !== bid) {
		return "--- deleted ---"
	}
	
	if(!tests) return;

	return <main>
		<nav>
		<Link to="/tr">Дети</Link>	
		</nav>	
		<h1><Link to={`/tr/${id}`}>{child.fio}</Link></h1>
		{!hasTests && '--- wait ---'}
		{hasTests && <>
			<h2>Тест № {step}</h2>
			о тесте<br/>
			<input wide="" value={test.trMeta.info} onChange={e=>{
				produceTests(draft=>{
					draft[idx].trMeta.info = e.target.value
				})
			}}/>
			<hr/>
			<div>
				Указания для родителей:<br/>
				<textarea wide="" value={test.meta.notes} onChange={e=>{
					produceTests(draft=>{
						draft[idx].meta.notes = e.target.value
					})					
				}}/>
			</div>
			<div>
				Нужные уровни:<br/>
				<div style={{display:"flex", gap: 10, justifyContent:"space-around"}}>
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
			</div>
			<hr/>
			<div style={{display:"flex", gap: 10, flexDirection: "column"}}>
				<button type="button"
					onClick={()=>{
						navigate('perform/tr')
					}} 
					>Заполнить ответы терапевта</button>
				<button type="button"
					onClick={()=>{
						navigate('perform/cl')
					}} 
					>Заполнить ответы за клиента
						<br/>
						({!test.cl && <b>ответы клиента получены</b>
							|| <i>клиент еще не заполнил анкету</i>
						})
				</button>
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
	</main>
}

function CreateTest() {
	const navigate = useNavigate()
	const {id} = useParams()
	const {index, login, produceIndex} = useOutletContext()
	const child = index.children[id]
	const [hasTests, tests, produceTests] = useLocalState(`tr-tests-${id}`,[])

	const npp = (tests?.length??0) + 1

	const [step, setStep] = useState('')
	const [info, setInfo] = useState('')
	const [levels, setLevels] = useState(allLevels)
	const [notes, setNotes] = useState('')
	return hasTests && <main>
		<h1>Создание анкеты оценки навыков</h1>
		<h2>Ребенок: {child.fio}</h2>
		<h3>Тест № {npp}</h3>
		{ step === '' &&<>
			Назначение:<br/>
			<input wide="" value={info} onChange={e=>setInfo(e.target.value)}/>
			<small>можно не заполнять</small>
			<br/>
			<button type="button" onClick={()=>{setStep('levels')}}>Далее</button>
			<button type="button" onClick={()=>navigate(-1)}>Отмена</button>
			</>
		}
		{ step === 'levels' &&<>
			Уровни, включаемые в оценку:<br/>
			<div style={{display:"flex", gap: 10, justifyContent:"space-around"}}>
			{
				allLevels.map((l,i)=><span key={l}>
					[<input type="checkbox" checked={l.in(...levels)}
						onChange={e=>
								setLevels(prev=> e.target.checked? [...prev, l]: prev.filter(x=>x!==l))
						}
					/>{i+1}]
				</span>)
			}
			</div>
			<button type="button" onClick={()=>{setStep('')}}>Назад</button>
			<button type="button" onClick={()=>{setStep('notes')}}>Далее</button>
			<button type="button" onClick={()=>navigate(-1)}>Отмена</button>
			</>
		}
		{ step === 'notes' &&<>
			Указания по заполнению:<br/>
			<textarea wide="" value={notes} onChange={e=>setNotes(e.target.value)}/>
			<button type="button" onClick={()=>{setStep('levels')}}>Назад</button>

			<button type="button" onClick={()=>{

				const bookId = getGlobalUniqueCode().replace(/[.]/g,'~')
				const iv = window.crypto.getRandomValues(new Uint8Array(12));

				produceTests(draft=>[...(draft??[]), {
					meta: {
						notes
						, levels
						, bookId 
						, ivHex: iv.toHex()
					}
					, trMeta: {
						info
					}
					, tr: {}
				}])

				produceIndex(draft=>{
						draft.children[id].lastOp = Date.now();
					})

				navigate(`/tr/${id}/test/${npp}/${bookId}`)
			}}>Создать анкету!</button>
			<button type="button" onClick={()=>navigate(-1)}>Отмена</button>
			</>
		}
	</main>
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

	return <main>
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
	</main>

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
			let lvl_sum = Array.from({length: tests.length}).fill(0);
			for(const part in qs[lvl]) {
				let part_sum = Array.from({length: tests.length}).fill(0);
				for(const maybeQ in qs[lvl][part]) {
					if(maybeQ.match(/^\d/)) {
						for(let i = 0; i< tests.length; ++i){
							part_sum[i] += rates[lvl][part][+maybeQ][i] ?? 0;
							lvl_sum[i] += rates[lvl][part][+maybeQ][i] ?? 0;
						}
					} else {
						for(const q in qs[lvl][part][maybeQ]) {
							for(let i = 0; i< tests.length; ++i){
								part_sum[i] += rates[lvl][part][+q][i] ?? 0;
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
		const ws = wb.addWorksheet('Оценка навыков');

		ws.columns = [
			{width: 4}, {width: 60}
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
			//row.outlineLevel = 1;
			row.getCell(2).fill = {type: 'pattern', pattern: 'solid'
					, fgColor: {argb: hcolors[lvl] ?? "AAAAAA"}}
			for(let i = 0; i<tests.length; ++i){
				row.getCell(1+2+i*4+3).fill = {type: 'pattern', pattern: 'solid'
					, fgColor: {argb: hcolors[lvl] ?? "AAAAAA"}}
			}

			for(const part in qs[lvl]) {
				row = ws.addRow([
					'', part
					, ...rates[lvl].$.map(r=>['','','', r])
				].flat()); ++rn;
				row.outlineLevel = 1;
				row.getCell(2).fill = {type: 'pattern', pattern: 'solid'
					, fgColor: {argb: 'CCCCCC'}}
				for(let i = 0; i<tests.length; ++i){
					row.getCell(1+2+i*4+3).fill = {type: 'pattern', pattern: 'solid'
						, fgColor: {argb: 'CCCCCC'}}
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
						row.outlineLevel = 1;
						row.getCell(1).fill = {type: 'pattern', pattern: 'solid'
								, fgColor: {argb: hcolors[lvl] ?? "AAAAAA"}}
						row.getCell(2).alignment = {wrapText:true}
					} else {
						row = ws.addRow([
							'', maybeQ[0] === '.' ? maybeQ.slice(1) : maybeQ
						].flat()); ++rn;
						row.outlineLevel = 1;
						row.getCell(2).fill = {type: 'pattern', pattern: 'solid'
							, fgColor: {argb: 'CCCCCC'}}
						for(const q in obj[maybeQ]) {
							row = ws.addRow([
								+q, obj[maybeQ][q].h
								, ...tests.map(t=>calcCols(
										t.tr?.[lvl]?.[part]?.[maybeQ]
										, t.cl?.[lvl]?.[part]?.[maybeQ]
										))
							].flat()); ++rn;
							row.outlineLevel = 1;
							row.getCell(1).fill = {type: 'pattern', pattern: 'solid'
									, fgColor: {argb: hcolors[lvl] ?? "AAAAAA"}}
							row.getCell(2).alignment = {wrapText:true}
						}
					}
				}
			}
		}

		ws.views = [
		  {state: 'frozen', xSplit: 2, ySplit: 3, topLeftCell: 'C4', activeCell: 'C4'}
		];

		const ws2 = wb.addWorksheet('Сравнение результатов тестов');

		ws2.columns = [
			{width: 60}
			, ...tests.map(()=>[{width: 15}])
		].flat();

		rn = 1;
		row = ws2.addRow(['Сравнение оценок тестов ESDM'])
		ws2.mergeCells(1,1,1,100)

		row = ws2.addRow([
			'Уровень и область навыков'
			, ...tests.map((_,i)=>[`Тест ${i+1}`])
		].flat()); ++rn;
		row.getCell(1).font = {bold: true}

		for(const lvl in qs) {
			row = ws2.addRow([
				lvl
			].flat()); ++rn;
			row.getCell(1).fill = {type: 'pattern', pattern: 'solid'
					, fgColor: {argb: hcolors[lvl] ?? "AAAAAA"}}
			row.getCell(1).font = {bold: true}

			for(const part in qs[lvl]) {
				row = ws2.addRow([
					part
					, ...rates[lvl].$
				].flat()); ++rn;
				row.getCell(1).fill = {type: 'pattern', pattern: 'solid'
					, fgColor: {argb: hcolors[lvl] ?? "AAAAAA"}}
				for(let i = 0; i<tests.length; ++i){
					row.getCell(1+1+i).fill = {type: 'pattern', pattern: 'solid'
						, fgColor: {argb: hcolors[lvl] ?? "AAAAAA"}}
				}
			}
			ws2.addRow([]); ++rn;
		}

		row	= ws2.addRow(['Общая оценка по уровням:']); ++rn;
		row.getCell(1).font = {bold: true}

		for(const lvl in qs) {
			let cnt = 0;
			for(const part in qs[lvl]) {
				const obj = qs[lvl][part]
				for(const maybeQ in obj) {
					if(maybeQ.match(/^\d/)) {
						// simple quest
						++cnt;
					} else {
						for(const q in obj[maybeQ]) {
							++cnt;
						}
					}
				}
			}
			row = ws2.addRow([
				`${lvl} (max ${cnt})`, ...rates[lvl].$
			].flat()); ++rn;
			row.getCell(1).fill = {type: 'pattern', pattern: 'solid'
					, fgColor: {argb: hcolors[lvl] ?? "AAAAAA"}}
			for(let i = 0; i<tests.length; ++i){
				row.getCell(1+1+i).fill = {type: 'pattern', pattern: 'solid'
					, fgColor: {argb: hcolors[lvl] ?? "AAAAAA"}}
			}
		}


		row	= ws2.addRow(['Процент освоения уровня:']); ++rn;
		row.getCell(1).font = {bold: true}

		for(const lvl in qs) {
			let cnt = 0;
			for(const part in qs[lvl]) {
				const obj = qs[lvl][part]
				for(const maybeQ in obj) {
					if(maybeQ.match(/^\d/)) ++cnt;
					else for(const q in obj[maybeQ]) ++cnt;
				}
			}
			row = ws2.addRow([
				lvl, ...rates[lvl].$.map(r=>r/cnt)
			].flat()); ++rn;
			row.getCell(1).fill = {type: 'pattern', pattern: 'solid'
					, fgColor: {argb: hcolors[lvl] ?? "AAAAAA"}}
			for(let i = 0; i<tests.length; ++i){
				row.getCell(1+1+i).fill = {type: 'pattern', pattern: 'solid'
					, fgColor: {argb: hcolors[lvl] ?? "AAAAAA"}}
				row.getCell(1+1+i).numFmt = '0.0%'
			}
		}

		ws2.addRow([]); ++rn;
		row = ws2.addRow([
			'Уровень и область навыков'
			, ...tests.map((_,i)=>[`Тест ${i+1}`])
		].flat()); ++rn;
		row.getCell(1).font = {bold: true}

		for(const lvl in qs) {
			row = ws2.addRow([
				lvl
			].flat()); ++rn;
			row.getCell(1).fill = {type: 'pattern', pattern: 'solid'
					, fgColor: {argb: hcolors[lvl] ?? "AAAAAA"}}
			row.getCell(1).font = {bold: true}

			for(const part in qs[lvl]) {
				let cnt = 0;
				const obj = qs[lvl][part]
				for(const maybeQ in obj) {
					if(maybeQ.match(/^\d/)) ++cnt;
					else for(const q in obj[maybeQ]) ++cnt;
				}
				row = ws2.addRow([
					part
					, ...rates[lvl].$.map(r=>r/cnt)
				].flat()); ++rn;
				row.getCell(1).fill = {type: 'pattern', pattern: 'solid'
					, fgColor: {argb: hcolors[lvl] ?? "AAAAAA"}}
				for(let i = 0; i<tests.length; ++i){
					row.getCell(1+1+i).fill = {type: 'pattern', pattern: 'solid'
						, fgColor: {argb: hcolors[lvl] ?? "AAAAAA"}}
					row.getCell(1+1+i).numFmt = '0.0%'
				}
			}
			ws2.addRow([]); ++rn;
		}


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