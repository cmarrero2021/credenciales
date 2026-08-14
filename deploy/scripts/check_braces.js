const fs=require('fs');
const target = '../../back/src/controllers.js';
const lines=fs.readFileSync(target,'utf8').split(/\r?\n/);
let bal=0;
for(let i=0;i<lines.length;i++){
	const line=lines[i];
	for(const ch of line){
		if(ch==='{') bal++; else if(ch==='}') bal--;
	}
	if(i<200 || (i>1500 && i<1800) || i>lines.length-5) console.log((i+1).toString().padStart(6)+" bal="+bal+" | "+line);
}
console.log('FINAL BAL=',bal);