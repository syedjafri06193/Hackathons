export interface QueueItem { id: string; kind: 'post'|'comment'; title: string; author: string; subreddit: string; reportCount: number; reportReasons: string[]; createdAt: number; permalink: string; score: number; reviewedBy: string|null; }
export interface ActionLogEntry { itemId: string; actor: string; action: 'approve'|'remove'|'spam'; timestamp: number; }
export interface ModStats { total: number; highPriority: number; byReason: Record<string,number>; oldestAgeMs: number; timestamp: number; }
export interface FilterOptions { reportType: string; sortBy: 'priority'|'newest'; onlyUnreviewed: boolean; }
export const QUEUE_CACHE_KEY = (sub: string) => `queue_cache:${sub}`;
export const STATS_KEY = (sub: string) => `stats:${sub}`;
export const LOG_KEY = (sub: string) => `action_log:${sub}`;
export const FILTER_KEY = (sub: string) => `saved_filters:${sub}`;
export const REPORT_REASONS = [{value:'spam',label:'Spam'},{value:'rules_violation',label:'Rule break'},{value:'harassment',label:'Harassment'},{value:'misinformation',label:'Misinfo'}] as const;
export function priorityScore(item: QueueItem): number { const ageHours=(Date.now()-item.createdAt)/3600000; const hb=item.reportReasons.some(r=>r.toLowerCase().includes('harass'))?5:0; return item.reportCount*3+hb+ageHours*2-Math.floor(item.score/100); }
export function applyFilters(items: QueueItem[], filters: FilterOptions): QueueItem[] { return items.filter(item=>{ if(filters.onlyUnreviewed&&item.reviewedBy!==null)return false; if(filters.reportType!=='all'){const reasons=item.reportReasons.map(r=>r.toLowerCase());if(!reasons.some(r=>r.includes(filters.reportType)))return false;} return true; }); }
export function buildStats(items: any[]): ModStats { const byReason:Record<string,number>={};let oldestAgeMs=0;let highPriority=0; for(const item of items){const reports=item.numReports??0;if(reports>=3)highPriority++;const ageMs=Date.now()-(item.createdAt?new Date(item.createdAt).getTime():Date.now());if(ageMs>oldestAgeMs)oldestAgeMs=ageMs;const reasons=item.userReports??[];for(const[reason]of reasons){const key=reason?.toLowerCase()??'other';byReason[key]=(byReason[key]??0)+1;}} return{total:items.length,highPriority,byReason,oldestAgeMs,timestamp:Date.now()}; }
export function formatAge(ms: number): string { const secs=Math.floor(ms/1000);if(secs<60)return secs+'s';const mins=Math.floor(secs/60);if(mins<60)return mins+'m';const hrs=Math.floor(mins/60);if(hrs<24)return hrs+'h';return Math.floor(hrs/24)+'d'; }
