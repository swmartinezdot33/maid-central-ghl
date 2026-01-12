import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { storeFieldMappings, getFieldMappings, type FieldMapping } from '@/lib/kv';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mappings } = body;

    if (!Array.isArray(mappings)) {
      return NextResponse.json(
        { error: 'Mappings must be an array' },
        { status: 400 }
      );
    }

    await storeFieldMappings(mappings as FieldMapping[]);
    return NextResponse.json({ success: true, mappings });
  } catch (error) {
    console.error('Error saving field mappings:', error);
    return NextResponse.json(
      { error: 'Failed to save mappings' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const mappings = await getFieldMappings();
    return NextResponse.json({ mappings });
  } catch (error) {
    console.error('Error fetching field mappings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mappings' },
      { status: 500 }
    );
  }
}











