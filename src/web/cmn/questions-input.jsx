import {produce} from "immer"
import {useState, useEffect, useCallback, useMemo} from 'react'
import {  useParams, useSearchParams } from 'react-router-dom';

import { get as getKV, set as setKV } from 'idb-keyval';
import {customStore} from 'azlib/common.mjs'

import {useLocalState} from 'azlib/local-db-item.mjs'

import qs from '../data/quests.mjs';

const flat = []

for(const lvl in qs) {
	for(const part in qs[lvl]) {
		const obj = qs[lvl][part]
		for(const maybeQ in obj) {
			if(maybeQ.match(/^\d/)) {
				// simple quest
				flat.push({
					lvl, ...obj[maybeQ] //h,d
					, part
					, hdr: part
					, npp: +maybeQ
				})
			} else {
				for(const q in obj[maybeQ]) {
					flat.push({
						lvl, ...obj[maybeQ][q] //h,d
						, part
						, hdr: maybeQ[0] === '.' ? maybeQ.slice(1) : `${part}: ${maybeQ}`
						, npp: +q
					})
				}
			}
		}
	}
}

const bstyle = {
	background: "none"
	, border: "none"
	, textAlign: "left"
}

export default function QInput({role}) {
	const params = useParams()
	const book = params?.b ?? '000';
	
	let bookName = `book-${book}.${role}`;


	const [searchParams, setSearchParams] = useSearchParams();
	const npp = +searchParams.get('n') || ''
	const setNpp = useCallback((f,back)=>
		setSearchParams(prevParams=>{
			const p = +prevParams.get('n');
			const n =  typeof f === "function"? f(p): f
			if(n) prevParams.set('n', n)
			else  prevParams.delete('n')
			return prevParams;
	}, back && {} || {replace: true}),[setSearchParams])

	const [hasResults, results, produceResults] = useLocalState(bookName,
			{
				meta:{
					notes: ''
					, levels: ["УРОВЕНЬ 1", "УРОВЕНЬ 2", "УРОВЕНЬ 3", "УРОВЕНЬ 4"]
					, period: ''
				}
				, [role]: {}
			}
		)

	const levels = results?.meta?.levels;
	const arr = useMemo(()=>
			levels 
			? flat.filter(a=>a.lvl.in(...levels))
			: flat
		, [levels]);
	const q = arr[npp-1];

	const r = q && results?.[role]?.[q.lvl]?.[q.part]?.[q.npp];
	const setR = useCallback(v => produceResults(draft=>{
								draft[role] ??= {}
								draft[role][q.lvl] ??= {}
								draft[role][q.lvl][q.part] ??= {}
								draft[role][q.lvl][q.part][q.npp] = v 				
			}), [role, q, produceResults])

	useEffect(()=>{
		const keydown = e=>{
			if(!q) return;
			console.log(e.key)
			switch(e.key){
			case ' ': setR(null); break;
			case '/': setR('+/-'); break;
			case 'ArrowUp': case '+': case '=': setR('+'); break;
			case 'ArrowDown': case '-': case '_': setR('-'); break;
			case 'ArrowLeft': setNpp(n=>n>1? n-1 : n); break;
			case 'ArrowRight': setNpp(n=>n<arr.length? n+1 : n); break;
			}
		}
		window.addEventListener('keydown', keydown)
		return ()=> window.removeEventListener('keydown', keydown)
	},[setNpp, setR, q, arr])

	return <div>
		{
			!hasResults && '--- wait ---'
		}
		{ hasResults && npp === '' && <div>
				<button type="button" onClick={()=>{setNpp(1, true)}}
						style={{position:"fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)"}}
				>Начать</button>
			</div>
		}
		{ hasResults && typeof npp === 'number' &&<div>
			<div style={{float:"right", marginRight:"1em"}}><button type="button" onClick={()=>setNpp('', true)}>H</button></div>
			<h6>{q.lvl}</h6>
			<h4>{q.hdr}</h4>
			<h3>{q.h}</h3>
			<div><i>{q.t}</i></div>
			<div
				style={{position:"fixed", bottom:"4em"}}
			>
				<table><tbody>
				<tr><td><input type="radio" onChange={()=>setR('+')}
						checked={r === '+'}
					/> 
					</td>
					<td>
					<button type="button" onClick={()=>setR('+')} style={bstyle}> 
					навык есть в 80 и более % случаев, работа над навыком не требуется
					</button>
					</td>
				</tr>
				<tr><td><input type="radio" onChange={()=>setR('+/-')}
						checked={r === '+/-'}
					/> 
					</td>
					<td>
					<button type="button" onClick={()=>setR('+/-')} style={bstyle}>
					навык в процессе формирования, иногда есть, иногда нет
					</button>
					</td>
				</tr>
				<tr><td><input type="radio" onChange={()=>setR('-')}
						checked={r === '-'}
					/> 
					</td>
					<td>
					<button type="button" onClick={()=>setR('-')} style={bstyle}>
					навыка практически или совсем нет
					</button>
					</td>
				</tr>
				<tr><td><input type="radio" onChange={()=>setR(null)}
						checked={r === null}
					/>
					</td>
					<td>
					<button type="button" onClick={()=>setR(null)} style={bstyle}>
					нельзя оценить навык и/или нет возможности проверить
					</button>
					</td>
				</tr>
				</tbody></table>
			</div>
			<div>
				{npp>1&&<button type="button" onClick={()=>{setNpp(n=>n-1)}}
						style={{position:"fixed", left: "1em", bottom: "1em"}}
					> &lt;-- </button>}
				{npp && <span
					style={{position:"fixed", bottom: "1em", left:"50%", transform:"translate(-50%,0)"}}
					>{npp}/{arr.length}</span>}
				{npp<flat.length&&<button type="button" onClick={()=>{setNpp(n=>n+1)}}
						style={{position:"fixed", right: "1em", bottom: "1em"}}
				> --&gt; </button>}
			</div>
		</div>
		}
	</div>
}