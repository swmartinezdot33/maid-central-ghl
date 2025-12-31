import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';
import { getLocationId } from '@/lib/request-utils';

/**
 * GET /api/maid-central/teams
 * Get all teams/employees from MaidCentral
 */
export async function GET(request: NextRequest) {
  try {
    const locationId = await getLocationId(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    const teams = await maidCentralAPI.getTeams(locationId);
    
    // Format teams for UI
    const formattedTeams = teams.map((team: any) => ({
      id: String(team.Id || team.id || team.TeamId || team.teamId || team.EmployeeId || team.employeeId),
      name: team.Name || team.name || team.TeamName || team.teamName || team.EmployeeName || team.employeeName || 'Unknown Team',
    }));
    
    return NextResponse.json({ teams: formattedTeams });
  } catch (error) {
    console.error('Error fetching MaidCentral teams:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch teams',
        teams: [],
      },
      { status: 500 }
    );
  }
}

