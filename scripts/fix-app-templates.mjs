import fs from "node:fs";
import parser from "@babel/parser";
import traverseModule from "@babel/traverse";
const traverse=traverseModule.default||traverseModule;

const file='src/App.jsx';
const src=fs.readFileSync(file,'utf8');
const ast=parser.parse(src,{sourceType:'module',plugins:['jsx']});

const cp1252 = new Map([[0x80,"€"],[0x82,"‚"],[0x83,"ƒ"],[0x84,"„"],[0x85,"…"],[0x86,"†"],[0x87,"‡"],[0x88,"ˆ"],[0x89,"‰"],[0x8A,"Š"],[0x8B,"‹"],[0x8C,"Œ"],[0x8E,"Ž"],[0x91,"‘"],[0x92,"’"],[0x93,"“"],[0x94,"”"],[0x95,"•"],[0x96,"–"],[0x97,"—"],[0x98,"˜"],[0x99,"™"],[0x9A,"š"],[0x9B,"›"],[0x9C,"œ"],[0x9E,"ž"],[0x9F,"Ÿ"]]);
const viChars="àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬĐÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ";
const extras="→•✓🧡🔖🕒🍽️🧾🚚🌶️💰📍⚡";
const all=[...new Set((viChars+extras).split(''))].filter(Boolean);
function moj1(ch){const bytes=Buffer.from(ch,'utf8');let out='';for(const b of bytes){out+=cp1252.get(b)||String.fromCharCode(b);}return out;}
const map=new Map();for(const ch of all){const a=moj1(ch),b=moj1(a);if(a!==ch)map.set(a,ch);if(b!==ch)map.set(b,ch);}const keys=[...map.keys()].sort((x,y)=>y.length-x.length);
const re=new RegExp(keys.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
const fix=(t)=>{let o=t;for(let i=0;i<4;i++){const n=o.replace(re,m=>map.get(m)||m);if(n===o)break;o=n;}return o;};

const edits=[];
traverse(ast,{TemplateElement(path){const old=path.node.value.raw;const neu=fix(old);if(neu!==old){edits.push({start:path.node.start,end:path.node.end,text:neu});}}});
edits.sort((a,b)=>b.start-a.start);
let out=src;for(const e of edits){out=out.slice(0,e.start)+e.text+out.slice(e.end);} 
if(out!==src){fs.writeFileSync(file,out,'utf8');console.log('template edits',edits.length);} else console.log('no template changes');
