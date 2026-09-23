type ReportFile={source:string;output:string;size:number;info:{format:string;width?:number;height?:number;pages?:number;dpi?:number};checks?:{label:string;passed:boolean;detail:string}[];warnings:string[]};
type Report={createdAt:string;files:ReportFile[]};
const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export function readableReport(report:Report):string{
 const rows=report.files.map(file=>{
  const details=[file.info.format.toUpperCase(),file.info.width&&file.info.height?`${file.info.width} × ${file.info.height} px`:'',file.info.pages?`${file.info.pages} 页`:'',file.info.dpi?`${file.info.dpi} DPI`:''].filter(Boolean).join(' · ');
  const checks=file.checks?.map(check=>`<li class="${check.passed?'ok':'fail'}">${check.passed?'✓':'✗'} ${escapeHtml(check.label)}：${escapeHtml(check.detail)}</li>`).join('')||'';
  const warnings=file.warnings.map(w=>`<li>${escapeHtml(w)}</li>`).join('');
  return `<section><h2>${escapeHtml(file.output)}</h2><p>原文件：${escapeHtml(file.source)}</p><p>${escapeHtml(details)} · ${escapeHtml(file.size.toLocaleString('zh-CN'))} 字节</p><ul>${checks}</ul>${warnings?`<p class="warning">注意</p><ul>${warnings}</ul>`:''}</section>`;
 }).join('');
 return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FileFit 验收报告</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:820px;margin:40px auto;padding:0 24px;color:#17352e;background:#f9faf7}header,section{background:white;border:1px solid #dce5df;border-radius:16px;padding:24px;margin:18px 0}h1,h2{line-height:1.25}h2{overflow-wrap:anywhere}ul{padding-left:24px}.ok{color:#237256}.fail,.warning{color:#a2402f}p{overflow-wrap:anywhere}</style><header><h1>FileFit 文件验收报告</h1><p>生成时间：${escapeHtml(report.createdAt)}</p><p>共 ${report.files.length} 个输出；逐项结果依据实际处理后的文件。</p></header>${rows}</html>`;
}
