import { NextResponse } from 'next/server';
import { getSynthraDexInfo } from '@/lib/synthraDex';
import { getUnitFlowDexInfo } from '@/lib/unitflowDex';
import { resolveSwapBackendUrl } from '@/lib/resolveSwapBackendUrl';

type DexInfo = {
  id: string;
  name: string;
  enabled: boolean;
  routerAddress?: string;
  factoryAddress?: string;
  quoterAddress?: string;
  universalRouterAddress?: string;
  multicallAddress?: string;
  permit2Address?: string;
  type?: string;
  chainId?: number;
  supportedTokens?: readonly string[];
  feeTiers?: readonly number[];
  poolAddresses?: readonly string[];
};

const HIDDEN_DEX_IDS = new Set(["swaparc", "quantum-exchange"]);

const getCanonicalSynthraDex = (): DexInfo => ({
  ...getSynthraDexInfo(),
  id: "synthra",
  name: "Synthra",
});

const getCanonicalUnitFlowDex = (): DexInfo => ({
  ...getUnitFlowDexInfo(),
  id: "unitflow",
  name: "UnitFlow",
});

const normalizeDex = (dex: DexInfo): DexInfo => {
  const id = String(dex.id || "").toLowerCase();
  const name = String(dex.name || "").toLowerCase();

  if (id === "synthra-v3" || id === "synthra" || name.includes("synthra")) {
    return {
      ...dex,
      id: "synthra",
      name: "Synthra",
      enabled: dex.enabled !== false,
    };
  }

  if (id === "unitflow-v3" || id === "unitflow" || name.includes("unitflow")) {
    return {
      ...dex,
      id: "unitflow",
      name: "UnitFlow",
      enabled: dex.enabled !== false,
    };
  }

  return dex;
};

const getVisibleDexes = (dexes: DexInfo[]) => {
  const visibleDexes = new Map<string, DexInfo>();

  for (const rawDex of dexes) {
    const dex = normalizeDex(rawDex);
    const id = String(dex.id || "").toLowerCase();
    const name = String(dex.name || "").toLowerCase();

    if (
      HIDDEN_DEX_IDS.has(id) ||
      name.includes("swaparc") ||
      name.includes("quantum")
    ) {
      continue;
    }

    if (!visibleDexes.has(id)) {
      visibleDexes.set(id, dex);
    }
  }

  return Array.from(visibleDexes.values());
};

/**
 * GET /api/swap/dexes
 * Returns list of available DEX routers for swap operations
 */
export async function GET() {
  try {
    const synthraDex = getCanonicalSynthraDex();
    const unitFlowDex = getCanonicalUnitFlowDex();
    // Fetch routers from backend API
    const backendUrl = resolveSwapBackendUrl();
    const response = await fetch(`${backendUrl}/api/swap/dexes`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Backend DEX API error:', response.statusText);
      return NextResponse.json({
        success: true,
        data: [synthraDex, unitFlowDex],
      });
    }

    const backendResponse = await response.json();
    console.log('[API Route] Backend response:', backendResponse);

    // Extract the data array from backend response
    const dexesArray = Array.isArray(backendResponse?.data) ? backendResponse.data : [];

    return NextResponse.json({
      success: true,
      data: getVisibleDexes([...dexesArray, synthraDex, unitFlowDex]),
    });
  } catch (error) {
    console.error('Error fetching DEXes:', error);
    return NextResponse.json({
      success: true,
      data: [getCanonicalSynthraDex(), getCanonicalUnitFlowDex()],
    });
  }
}
