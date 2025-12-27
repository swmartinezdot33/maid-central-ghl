import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/auth/oauth/debug-storage
 * Debug endpoint to check what's actually in the database
 */
export async function GET(request: NextRequest) {
  try {
    const locationId = request.nextUrl.searchParams.get('locationId');
    
    if (!locationId) {
      return NextResponse.json({
        error: 'Location ID is required',
      }, { status: 400 });
    }
    
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        error: 'DATABASE_URL not configured',
      }, { status: 500 });
    }
    
    const { initDatabase } = await import('@/lib/db');
    await initDatabase();
    const sql = neon(process.env.DATABASE_URL);
    
    // Check if table exists and get all tokens
    const allTokens = await sql`
      SELECT 
        id, 
        location_id, 
        LENGTH(access_token) as access_token_length,
        LENGTH(refresh_token) as refresh_token_length,
        expires_at,
        token_type,
        scope,
        user_id,
        company_id,
        installed_at,
        created_at,
        updated_at
      FROM ghl_oauth_tokens
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    // Check for exact locationId match
    const exactMatch = await sql`
      SELECT 
        id, 
        location_id, 
        LENGTH(access_token) as access_token_length,
        expires_at,
        installed_at
      FROM ghl_oauth_tokens
      WHERE location_id = ${locationId}
      LIMIT 1
    `;
    
    // Check for similar locationIds (case-insensitive, trimmed)
    const similarMatches = await sql`
      SELECT 
        id, 
        location_id, 
        LENGTH(access_token) as access_token_length
      FROM ghl_oauth_tokens
      WHERE LOWER(TRIM(location_id)) = LOWER(TRIM(${locationId}))
      LIMIT 5
    `;
    
    return NextResponse.json({
      locationId,
      searchResults: {
        exactMatch: exactMatch.length > 0 ? {
          found: true,
          id: exactMatch[0].id,
          location_id: exactMatch[0].location_id,
          access_token_length: exactMatch[0].access_token_length,
          expires_at: exactMatch[0].expires_at,
          installed_at: exactMatch[0].installed_at,
        } : {
          found: false,
        },
        similarMatches: similarMatches.map(row => ({
          id: row.id,
          location_id: row.location_id,
          location_id_length: row.location_id?.length,
          access_token_length: row.access_token_length,
        })),
      },
      allTokens: allTokens.map(row => ({
        id: row.id,
        location_id: row.location_id,
        location_id_length: row.location_id?.length,
        access_token_length: row.access_token_length,
        refresh_token_length: row.refresh_token_length,
        expires_at: row.expires_at,
        installed_at: row.installed_at,
      })),
      analysis: {
        totalTokens: allTokens.length,
        exactMatchFound: exactMatch.length > 0,
        locationIdLength: locationId.length,
        locationIdCharacters: locationId.split('').map((c, i) => ({ pos: i, char: c, code: c.charCodeAt(0) })),
      },
    });
  } catch (error) {
    console.error('[Debug Storage] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

