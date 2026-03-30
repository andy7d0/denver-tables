<?php
\define_api_route(function($login, $file){
	$dir = \az\settings\normFileName($login);
	$dir = \az\settings\STORAGE."/$dir"; 
	mkdir($dir);
	if(file_exists("$dir/key-file")) return false;
	file_put_contents("$dir/key-file", $file);
	return true;
});
