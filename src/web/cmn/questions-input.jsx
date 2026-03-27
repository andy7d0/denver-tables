import {useEffect, useCallback, useMemo} from 'react'
import { useSearchParams, Link } from 'react-router-dom';

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

export default function QInput({meta, value, valSetter
	, lastPage
	}) {	
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


	const levels = meta?.levels;
	const arr = useMemo(()=>
			levels 
			? flat.filter(a=>a.lvl.in(...levels))
			: flat
		, [levels]);

	const q = arr[npp-1];

	const r = q && value?.[q.lvl]?.[q.part]?.[q.npp];
	const setR = useCallback(v => valSetter(q,v), [valSetter, q])

	useEffect(()=>{
		const keydown = e=>{
			console.log(e.key)
			switch(e.key){
			case ' ': setR('x'); break;
			case '/': case '.': setR('+/-'); break;
			case 'ArrowUp': case '+': case '=': setR('+'); break;
			case 'ArrowDown': case '-': case '_': setR('-'); break;
			case 'Home': setNpp(0,true); break;
			case 'End':  setNpp(arr.length+1); break;
			case 'ArrowLeft': setNpp(n=>n>1? n-1 : n); break;
			case 'ArrowRight': setNpp(n=>n<=arr.length? n+1 : n); break;
			}
		}
		window.addEventListener('keydown', keydown)
		return ()=> window.removeEventListener('keydown', keydown)
	},[setNpp, setR, q, arr])

	return <div>
		{ !npp && <div style={{position:"fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)"
			, width:"90%"}}>
				{meta.notes && <div>Указания терапевта:</div>}
				<pre>
					{
						meta.notes
					}
				</pre>
				<div style={{display: "flex", alignItems: "center", justifyContent: "center"}}>
					<button type="button" onClick={()=>{setNpp(1, true)}}>Начать заполнение</button>
				</div>
			</div>
		}
		{ npp === arr?.length+1 && lastPage}
		{ !!npp && npp <= arr.length &&<div>
			<h6>{q.lvl}</h6>
			<h4>{q.hdr}</h4>
			<h3>{q.h}</h3>
			<div><i>{q.t}</i></div>
		</div>}
			<div
				style={{position:"fixed"
					, bottom:"0em"
					, background: "white"
					, height: "12em"
					, width: 380
					, left: "50%"
					, transform: "translate(-50%,0)"
					}}
			>
			{npp && npp<=arr.length && <table style={{width:"100%"}}><tbody>
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
			<tr><td><input type="radio" onChange={()=>setR('x')}
					checked={r === 'x'}
				/>
				</td>
				<td>
				<button type="button" onClick={()=>setR('x')} style={bstyle}>
				нельзя оценить навык и/или нет возможности проверить
				</button>
				</td>
			</tr>
			</tbody></table>}
			<div style={{position:"absolute", bottom:10, width:"100%"}}>
				{npp>=1&&<button type="button" onClick={()=>{setNpp(0,true)}}
						style={{float:"left"}}
					> |&lt; </button>}
				{npp>=1&&<button type="button" onClick={()=>{setNpp(n=>n-1)}}
						style={{float:"left"}}
					> &lt;-- </button>}
				{npp<=arr.length&&<button type="button" onClick={()=>{setNpp(arr.length+1)}}
						style={{float:"right"}}
				> &gt;| </button>}
				{npp<=arr.length&&<button type="button" onClick={()=>{setNpp(n=>n+1)}}
						style={{float:"right"}}
				> --&gt; </button>}
				{npp && npp <= arr.length && <span
					style={{position:"absolute", bottom: 0, left:"50%", transform:"translate(-50%,0)"}}
					>{npp}/{arr.length}</span>}
			</div>
		</div>
	</div>
}