import {produce} from "immer"
import {useState, useEffect, useCallback} from 'react'

import { get as getKV, set as setKV } from 'idb-keyval';
import {customStore} from './common.mjs'

export function useLocalState(key, def, suspend) {
	const [item, setItem] = useState()
	const done = item!==undefined;
	useEffect(()=>{
		if(suspend || done) return;
		customStore()
		.then(cs=>getKV(key,cs))
		.then(val=>{
			val ??= def;
			setItem(val)
		})
	}, [done, setItem, key, def, suspend])

	const produceItem = useCallback(producer=>{
			setItem(prev=>{
				const next = produce(prev, producer)
				customStore()
				.then(cs=>setKV(key, next, cs))
				return next
			})
		}, [key, setItem])

	return [done, item, produceItem]
}