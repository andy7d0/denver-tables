import {useCallback} from 'react'
import {  useParams } from 'react-router-dom';

import {useLocalState} from 'azlib/local-db-item.mjs'

import {clientRead, sendToTr} from '../cmn/exchange.mjs'


import QInput from '../cmn/questions-input.jsx';

export default function ClientPage() {
	const params = useParams()
	const book = params?.b;

	let bookName = `book-${book}`;

	const [hasResults, results, produceResults] = useLocalState(bookName,
		async key => {
			const def = await clientRead(bookName, window.initialHash)
			if(def) return def;
			return {
				meta:{
					notes: ''
					, levels: ["УРОВЕНЬ 1", "УРОВЕНЬ 2", "УРОВЕНЬ 3", "УРОВЕНЬ 4"]
					, period: ''
				}
				, cl: {}
			}
		}
	)

	const valSetter = useCallback((q, v) => produceResults(draft=>{
		draft.cl ??= {}
		draft.cl[q.lvl] ??= {}
		draft.cl[q.lvl][q.part] ??= {}
		draft.cl[q.lvl][q.part][q.npp] = v 						
	}),[produceResults])

	return <main>
		{!hasResults && '--- wait ---'}
		{hasResults && <QInput meta={results?.meta} value={results?.cl}  valSetter={valSetter} 
				lastPage={
				<div>
					<button type="button" 
						style={{position:"fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)"}}
						onClick={async ()=>{
							await sendToTr(results)
							window.close()
						}}
					>Завершить заполнение и отправить результаты</button>
				</div>
				}
		/>}
	</main>
}