import {produce} from "immer"
import {useState, useEffect, useCallback} from 'react'

import { get as getKV, set as setKV, update as updateKV 
	, getMany as getManyKV, setMany as setManyKV
} from 'idb-keyval';
import {userStore, ukeyEncode, ukeyDecode
	, broadcast, broadcastOthers, subscribe
	, otherWindows
} from './common.mjs'

import {sha256}  from  'js-sha256';

let seqVar = Promise.resolve()

let in_get = false

export function seqGet(key) {
	// console.log(`ask get ${key}`)
	return seqVar = seqVar
			.then(async ()=>{
				//console.log(`get ${key}`, in_get); 
				in_get = true; 
				const cs = await userStore();
				const r = await ukeyDecode(await getKV(key, cs));
				//console.log(`got ${key}`, r); 
				in_get = false; 
				return r;
			})
}

export function seqSave(key, val) {
	// console.log(`ask set ${key}`)
	return seqVar = seqVar
			.then(async ()=>{
				//console.log(`set ${key}`);
				const cs = await userStore();
				const r = await setKV(key, await ukeyEncode(val), cs);
				//console.log(`setted ${key}`); 
				return r;
			});
}

export function syncSave() { return seqVar; }


const localStateKeys = {}
subscribe('localStateChanged', arr => {
	for(const [k,v] of arr) {
		if(localStateKeys[k])
			for(const f of localStateKeys[k]) f(v);
	}
})

export function useLocalState(key, def, {suspend, syncMonitor }={}) {
	const [item, setItem] = useState()
	const done = item?.key === key;
	useEffect(()=>{
		if(suspend || done) return;
		seqGet(key)
		.then(val=>{
			if(val!==undefined && val!==null) return val;
			if(typeof def !== 'function') return def;
			return def(key) // async compatible
		})
		.then(val=>setItem({val,key}))
	}, [done, setItem, key, def, suspend])

	const produceItem = useCallback(producer=>{
			setItem(prev=>{
				const next = produce(prev.val, producer)
				const ret = {key:prev.key, val:next}
				seqSave(prev.key, next)
				.then(()=>
					// queue change
					await updateKV('changed', c => (c??new Map()).set(ret.key, ret.val), await userStore())
					broadcastOthers('localStateChanged', [ret.key, ret.val])
				)
				return ret;
			})
			return syncSave();
		}, [setItem])

	useEffect(()=>{
		const f = v => setItem(v)
		localStateKeys[key] ??= new Set();
		localStateKeys[key].add(f)
		return () => localStateKeys[key].delete(f) //FIXME: leak keys but it's not important
	}, [key, setItem])

	useEffect(()=>syncMonitor?.(key), [syncMonitor, key])

	return [done, item?.val, produceItem]
}

function monitorLoop(func) {
	navigator.locks.request('keysMonitor', {ifAvailable: true}
		, locked=>
			func(locked)
			.then(repeat=>
					window.setTimeout(monitorLoop, repeat? 10: 1000, func)
				)
	)
}

export function monitorSource(name, syncFunc, mergeFunc) {
	const monitoredKeys = {};
	window.azMonitoredKeys = monitoredKeys; // share between windows

	async function checkKeys(locked) {
		if(!locked) return;
		try{
			let keys = [...new Set(
								[...Object.keys(monitoredKeys)
								, ...Object.values(otherWindows())
									 .map(w=>Object.keys(w.azMonitoredKeys))
								].flat())
						]
			if(!keys.length) return;
			const us = await userStore();
			const items = getManyKV(keys, us);
			// items -> encoded!! use checksum as version
			const wrt = await getKV('changed', us) ?? (new Map())
			const request = 
				Object.keys(monitoredKeys).map((k,i)=>[k,sha256(items[i]), wrt.get(k)])
			let response = await syncFunc(request)
			if(response) {
				response = response.map(([k,v], i)=> [k, 
						mergeFunc(k, await ukeyDecode(v), await ukeyDecode(items[i]))] )
				await setManyKV(response, us)

				const mergedWrt = new Map()
				// some changes successfully written and some of them changed
				for(const [k,v] of response)
					if(wrt.has(k))
						mergedWrt.set(k,v)

				await setKV('changed', mergedWrt, us)
				broadcast('localStateChanged', response)
				if(mergedWrt.size) return true;
			}
		} cactc(e) {
			console.error('bg sync', e);
		}
	}

	monitorLoop(checkKeys)

	return key => { monitoredKeys[key] ??= 0; ++monitoredKeys[key]; 
					return () => { if(!--monitoredKeys[key]) delete monitoredKeys[key]; }  
				}
}

/*
	usage:
	
	motitorSource('name-of-event', reader_function, merge_item_function)
	name-of-event - consistent acros affected windows
	also, we need some sort of localStateUpdate function
	if encapsulated into useLocalState, can be omited!

	TODO: awoid explicit name


	server side
	if we write something we check version and marge instead

	read -> write has a problem if some body writes in the middle

	read+write can lock!

	so it is consistent acros allt peers (we needs lock at user level only!) 
	or file-by-file

	sync returns 
	1) changed objects
	2) unwritten objects


*/
