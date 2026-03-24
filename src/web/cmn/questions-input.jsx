import {useState, useEffect, useCallback} from 'react'
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

export default function QInput() {
	const [npp, setNpp] = useState()
	const arr = flat;
	const q = arr[npp-1];
	const [results, setResults] = useState({})
	const k = q && `${q.lvl}.${q.part}.${q.npp}`
	const r = results[k]
	const setR = useCallback(v => { setResults(results => ({...results, [k]: v })) }
			, [setResults, k])

	useEffect(()=>{
		const keydown = e=>{
			if(!k) return;
			console.log(e.key)
			switch(e.key){
			case ' ': setR(null); break;
			case '/': setR('+/-'); break;
			case 'ArrowUp': case '+': case '=': setR('+'); break;
			case 'ArrowDown': case '-': case '_': setR('-'); break;
			case 'ArrowLeft': setNpp(n=>n>1? n-1 : n); break;
			case 'ArrowRight': setNpp(n=>n<arr.length-1? n+1 : n); break;
			}
		}
		window.addEventListener('keydown', keydown)
		return ()=> window.removeEventListener('keydown', keydown)
	},[setNpp, setR, k, arr])

	return <div>
		{!npp && <div>
				<button type="button" onClick={()=>{setNpp(1)}}
						style={{position:"fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)"}}
				>Начать</button>
			</div>
		}
		{ npp &&<div>
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
				<span
					style={{position:"fixed", bottom: "1em", left:"50%", transform:"translate(-50%,0)"}}
					>{npp}/{arr.length}</span>
				{npp<flat.length-1&&<button type="button" onClick={()=>{setNpp(n=>n+1)}}
						style={{position:"fixed", right: "1em", bottom: "1em"}}
				> --&gt; </button>}
			</div>
		</div>
		}
	</div>
}