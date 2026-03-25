import {useCallback} from 'react'
import {  useParams } from 'react-router-dom';

import {useLocalState} from 'azlib/local-db-item.mjs'

import {get as getKV} from 'idb-keyval';
import {customStore} from 'azlib/common.mjs'


import QInput from '../cmn/questions-input.jsx';

export default function ClientPage() {
	const params = useParams()
	const book = params?.b;

	let bookName = `book-${book}`;

	const [hasResults, results, produceResults] = useLocalState(bookName,
		async key => {
			const def = await getKV(`to-cl-${key}`, await customStore())
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

	return <section>
		{!hasResults && '--- wait ---'}
		{hasResults && <QInput meta={results?.meta} value={results?.cl}  valSetter={valSetter} />}
	</section>
}