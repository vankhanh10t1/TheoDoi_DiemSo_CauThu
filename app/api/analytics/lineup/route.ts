import { NextRequest, NextResponse } from 'next/server';
import { getLineupAnalytics } from '../../../../lib/analytics/lineup';
import { normalizeMatchTag, validateMatchTag } from '../../../../lib/match-tags';
import { isValidMatchDate } from '../../../../lib/match-datetime';

export async function GET(request: NextRequest) {
  try {
    const params=request.nextUrl.searchParams,value=Number(params.get('window')??10);
    if(![5,10,20].includes(value)) return NextResponse.json({error:'window phải là 5, 10 hoặc 20',code:'INVALID_WINDOW'},{status:400});
    for(const key of ['season','competition','matchType'] as const) if(!validateMatchTag(params.get(key))) return NextResponse.json({error:`${key} phải là chuỗi tối đa 80 ký tự`,code:'INVALID_FILTER'},{status:400});
    const dateFrom=params.get('dateFrom')||undefined,dateTo=params.get('dateTo')||undefined;
    if((dateFrom&&!isValidMatchDate(dateFrom))||(dateTo&&!isValidMatchDate(dateTo))||(dateFrom&&dateTo&&dateFrom>dateTo)) return NextResponse.json({error:'Khoảng ngày không hợp lệ',code:'INVALID_DATE_RANGE'},{status:400});
    return NextResponse.json({success:true,...await getLineupAnalytics(value as 5|10|20,{season:normalizeMatchTag(params.get('season')),competition:normalizeMatchTag(params.get('competition')),matchType:normalizeMatchTag(params.get('matchType')),dateFrom,dateTo})});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:'Không thể tải phân tích đội hình',code:'INTERNAL_ERROR'},{status:500});
  }
}
