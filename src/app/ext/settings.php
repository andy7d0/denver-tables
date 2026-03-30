<?php namespace az\settings;


const SERVER_PORT = 9580;
const MAX_COROUTINE = 3000;
const WORKER_NUM = 2; //TODO: dev/prod
const MAX_CONNECTION = 1000; //TODO: dev/prod
const PACKAGE_MAX_LENGTH = 10_000_000; // 10M

const MAX_WAIT_TIME = 0.1; //it's dev, prod should be much bigger

const HOLDED_CONNECTIONS = ['main' => 64]; 

const ADMIN_SERVER = '0.0.0.0:9582';

const MAX_CONCURRENCY = 1_000_000;
const WORKER_MAX_CONCURRENCY = 10_000;

const AUTHENTICATED_URLS = 'user|semistaff|staff|sysop|admin';
const AUTH_TTL = 5*60; // 5m
const COOKIE_KEY = 'D2fq9No8pzsTb12nRX';
const INTERNAL_KEY = '3751489357298054017541985473248955743287t754289t7243985798';


function roles($uinfo) {
	$roles = [];
	switch(@$uinfo->sysrole) {
		case 'admin': $roles['admin'] = true;
		case 'sysop': $roles['sysop'] = true;
		case 'staff': $roles['staff'] = true;
		case 'semistaff': $roles['semistaff'] = true;
		default: $roles['user'] = true;
	}
	return $roles;	
}


const STORAGE = '/var/denver';

function normFileName($fileName) {
	return urlencode($fileName);
}