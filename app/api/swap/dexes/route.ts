import { NextResponse } from 'next/server';

/**
 * GET /api/swap/dexes
 * Returns list of available DEX routers for swap operations
 */
export async function GET() {
  try {
    // Fetch routers from backend API
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/swap/dexes`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Backend DEX API error:', response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch DEXes from backend' },
        { status: response.status }
      );
    }

    const backendResponse = await response.json();
    console.log('[API Route] Backend response:', backendResponse);

    // Extract the data array from backend response
    const dexesArray = backendResponse?.data || [];

    return NextResponse.json({
      success: true,
      data: dexesArray,
    });
  } catch (error) {
    console.error('Error fetching DEXes:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch DEXes',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
