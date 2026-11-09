import {NextRequest,NextResponse} from 'next/server';
import {BetaAnalyticsDataClient} from '@google-analytics/data';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const property='494454950';
const valid=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v);
export async function GET(req:NextRequest){
 const start=req.nextUrl.searchParams.get('start')||'2026-08-11';
 const end=req.nextUrl.searchParams.get('end')||'2026-11-08';
 if(!valid(start)||!valid(end)||start>end)return NextResponse.json({error:'Período inválido'},{status:400});
 const raw=process.env.GA4_SERVICE_ACCOUNT_JSON;
 if(!raw)return NextResponse.json({error:'Conexão GA4 não configurada. Defina GA4_SERVICE_ACCOUNT_JSON no .env.local e conceda acesso de leitura à conta de serviço na propriedade 494454950.'},{status:503});
 try{
  const credentials=JSON.parse(raw); if(credentials.private_key) credentials.private_key=credentials.private_key.replace(/\\n/g,'\n'); const client=new BetaAnalyticsDataClient({credentials});
  const range=[{startDate:start,endDate:end}];
  async function report(dimensions:string[],metrics:string[],all=false){
   const result:{dimensions:string[],metrics:number[]}[]=[];let offset=0;
   do{
    const [r]=await client.runReport({property:`properties/${property}`,dateRanges:range,dimensions:dimensions.map(name=>({name})),metrics:metrics.map(name=>({name})),limit:all?10000:1000,offset,keepEmptyRows:false});
    const rows=(r.rows||[]).map(row=>({dimensions:(row.dimensionValues||[]).map(v=>v.value||''),metrics:(row.metricValues||[]).map(v=>Number(v.value||0))}));
    result.push(...rows);offset+=rows.length;
    if(!all||!rows.length||offset>=Number(r.rowCount||0)||offset>=1000000)break;
   }while(true);
   return result;
  }
  const [totals,paths,events,channels,devices,countries,landings,items]=await Promise.all([
   report([],['sessions','activeUsers','screenPageViews','engagedSessions','engagementRate','averageSessionDuration']),
   report(['pagePath'],['screenPageViews'],true),
   report(['eventName'],['eventCount'],true),
   report(['sessionDefaultChannelGroup'],['sessions'],true),
   report(['deviceCategory'],['sessions'],true),
   report(['country'],['sessions'],true),
   report(['landingPage'],['sessions'],true),
   report(['itemName'],['itemsViewed','itemsAddedToCart'],true)
  ]);
  const t=totals[0]?.metrics||[];
  return NextResponse.json({source:'ga4-live',period:{from:start,to:end},overview:{sessions:t[0]||0,activeUsers:t[1]||0,pageViews:t[2]||0,engagedSessions:t[3]||0,engagementRate:t[4]||0,avgSessionSeconds:t[5]||0},pages:paths.map(x=>({path:x.dimensions[0],views:x.metrics[0]})).sort((a,b)=>b.views-a.views),events:events.map(x=>({name:x.dimensions[0],count:x.metrics[0]})),channels:channels.map(x=>({name:x.dimensions[0],sessions:x.metrics[0]})).sort((a,b)=>b.sessions-a.sessions),devices:devices.map(x=>({name:x.dimensions[0],sessions:x.metrics[0]})),countries:countries.map(x=>({name:x.dimensions[0],sessions:x.metrics[0]})).sort((a,b)=>b.sessions-a.sessions),landings:landings.map(x=>({path:x.dimensions[0],sessions:x.metrics[0]})).sort((a,b)=>b.sessions-a.sessions),products:items.filter(x=>x.dimensions[0]).map(x=>({name:x.dimensions[0],views:x.metrics[0],quoteAdds:x.metrics[1]})).sort((a,b)=>b.views-a.views)});
 }catch(e){console.error('GA4 error',e);return NextResponse.json({error:'Falha na consulta GA4. Verifique as permissões e credenciais da conta de serviço.'},{status:502});}
}
