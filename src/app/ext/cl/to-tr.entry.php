<?php
\define_api_route(function($fname, $data){
	if(!str_starts_with($fname, 'to-tr-book-')) { throw new ResourceNotFound(); }
	mkdir(\az\settings\STORAGE."/_");
	$file = \az\settings\normFileName($fname);
	$file = \az\settings\STORAGE."/_/$file";
	file_put_contents($file, $data); 
}
,__FILE__);
