import { NextRequest, NextResponse } from 'next/server';
import { getLineupAnalytics } from '../../../../lib/analytics/lineup';

export async function GET(request: NextRequest) {
  try {
    const value=Number(request.nextUrl.searchParams.get('window')??10);
    if(![5,10,20].includes(value)) return NextResponse.json({error:'window phải là 5, 10 hoặc 20',code:'INVALID_WINDOW'},{status:400});
    return NextResponse.json({success:true,...await getLineupAnalytics(value as 5|10|20)});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:'Không thể tải phân tích đội hình',code:'INTERNAL_ERROR'},{status:500});
  }
}
