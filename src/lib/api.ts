const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");

// ---------------------------------------------
// TYPES
// ---------------------------------------------

export type PortalUser = {
  id?: string;
  name?: string;
  email?: string;
  title?: string;
  phone?: string;
  avatar?: string;
  hasAvatar?: boolean;
  avatarUpdatedAt?: string | null;
  brandId: string;
  clientName?: string;
  brandHasLogo?: boolean;
  brandLogoUpdatedAt?: string;
  firstLogin?: boolean;
  [key: string]: unknown;
};

export type PortalScope = {
  brandId: string;
  clientName?: string;
};

export type PortalAnalytics = {
  events: {
    date: string;
    campaign: string;
    spend: number;
    budgetPending: boolean;
    reach: number;
    engagements: number;
    impressions: number;
    clicks: number;
    live: boolean;
    liveCreators: number;
    measured: boolean;
    measuredCreators: number;
    totalCreators: number;
  }[];

  spendByService: Record<string, number>;

  excluded: {
    campaigns: number;
    spend: number;
  };

  note?: string;
};

// ---------------------------------------------
// PORTAL CREATOR
// ---------------------------------------------

export type PortalCreator = {
  id?: string;
  ref?: string;

  name?: string;
  handle?: string;
  platform?: string;

  followers?: number | string;
  avgLikes?: number | string;
  avgER?: number;

  status?: string;
  state?: string;
  niche?: string;

  // Brand-billed creator amount (clientCost mapped to cost)
  cost?: number | string | null;

  live?: {
    status?: string;
    postUrl?: string | null;
    postUrls?: string[];
    postedDate?: string | null;
  } | null;

  tracking?: {
    views?: number | null;
    likes?: number | null;
    comments?: number | null;
    forwards?: number | null;
    postsCounted?: number;
    lastFetched?: string | null;
    history?: {
      at?: string;
      views?: number | null;
      likes?: number | null;
      comments?: number | null;
      forwards?: number | null;
      posts?: number;
    }[];
  } | null;

  [key: string]: unknown;
};

// ---------------------------------------------
// PORTAL CAMPAIGN
// ---------------------------------------------

export type PortalCampaign = {
  id?: string;
  _id?: string;

  name?: string;
  client?: string;
  service?: string;
  region?: string;

  stage?: string;

  budget?: number | string | null;
  agencyFee?: number | string | null;
  agencyFeePct?: number | string | null;

  numReq?: number | null;
  deliverablesPerCreator?: number;

  start?: string | null;
  end?: string | null;

  brief?: {
    objective?: string;
    audience?: string;
    messages?: string;
    deliverables?: string[];
    budget?: string;
    timeline?: string;
  };

  briefStatus?: string;

  creators?: PortalCreator[];

  [key: string]: unknown;
};

export type PortalReel = {
  id?: string;
  code?: string;
  username?: string;
  platform?: string;
  kind?: string;
  thumbnail?: string;
  video?: string;
  caption?: string;
  permalink?: string;
  takenAt?: string;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  [key: string]: unknown;
};

export type PortalProfilePatch = {
  name: string;
  title: string;
  phone: string;
};

export type PortalClient = {
  id?: string;
  _id?: string;
  name?: string;
  website?: string;
  industry?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  brandHasLogo?: boolean;
  brandLogoUpdatedAt?: string | null;
  [key: string]: unknown;
};

// ---------------------------------------------
// COMMON API HELPERS
// ---------------------------------------------

function getApiUrl(): string {
  if (!API_BASE_URL) {
    throw new Error(
      "Backend URL is missing. Please configure EXPO_PUBLIC_API_URL in .env."
    );
  }

  return API_BASE_URL;
}

function buildScopeParams(scope: PortalScope): string {
  const params = new URLSearchParams();

  if (scope.brandId) {
    params.set("brand", scope.brandId);
  }

  if (scope.clientName) {
    params.set("client", scope.clientName);
  }

  return params.toString();
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Unable to connect to the server. Check your internet connection and backend URL."
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `API request failed. Server returned ${response.status}.`
    );
  }

  return data as T;
}

// ---------------------------------------------
// PORTAL LOGIN
// ---------------------------------------------

export async function portalLogin(
  email: string,
  password: string
): Promise<PortalUser> {
  const data = await apiRequest<{
    ok: boolean;
    user: PortalUser;
  }>("/api/auth/portal-login", {
    method: "POST",
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  });

  if (!data?.ok || !data?.user?.brandId) {
    throw new Error(
      "The server returned an invalid login response. Please contact support."
    );
  }

  return data.user;
}

// ---------------------------------------------
// PORTAL ANALYTICS
// ---------------------------------------------

export async function getPortalAnalytics(
  scope: PortalScope
): Promise<PortalAnalytics> {
  const query = buildScopeParams(scope);

  return apiRequest<PortalAnalytics>(
    `/api/portal/analytics?${query}`
  );
}

// ---------------------------------------------
// PORTAL CAMPAIGNS
// ---------------------------------------------

export async function getPortalCampaigns(
  scope: PortalScope
): Promise<PortalCampaign[]> {
  const query = buildScopeParams(scope);

  const data = await apiRequest<PortalCampaign[]>(
    `/api/portal/campaigns?${query}`
  );

  return Array.isArray(data) ? data : [];
}

// ---------------------------------------------
// PORTAL BILLING
// ---------------------------------------------

// Billing uses the same campaign API as the web portal.
// Creator cost represents the amount charged to the brand.

export type PortalBillingLine = {
  key: string;
  label: string;
  handle?: string;
  amount: number;
  share: number | null;
  fee?: boolean;
};

export type PortalCampaignBilling = {
  rows: PortalBillingLine[];
  creatorTotal: number;
  fee: number;
  listed: number;
  base: number;
  diff: number;
  itemised: number;
  rosterCount: number;
};

function billingNumber(value: unknown): number {
  const parsed = Number(
    String(value ?? "").replace(/[₹,\s]/g, "")
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

// Same calculation as the web portal's budgetLines().
export function calculateCampaignBilling(
  campaign: PortalCampaign
): PortalCampaignBilling {
  const creators = campaign.creators ?? [];

  const rows: PortalBillingLine[] = creators
    .map((creator) => ({
      key: creator.handle || creator.name || "",
      label: creator.name || "—",
      handle: creator.handle || "",
      amount: billingNumber(creator.cost),
      share: null,
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const creatorTotal = rows.reduce(
    (sum, row) => sum + row.amount,
    0
  );

  const fee = billingNumber(campaign.agencyFee);

  if (fee > 0) {
    rows.push({
      key: "__fee",
      label: "Agency fee",
      amount: fee,
      share: null,
      fee: true,
    });
  }

  const listed = creatorTotal + fee;
  const campaignBudget = billingNumber(campaign.budget);
  const base = campaignBudget > 0 ? campaignBudget : listed;

  const itemisedRows = rows.map((row) => ({
    ...row,
    share: base > 0 ? (row.amount / base) * 100 : null,
  }));

  return {
    rows: itemisedRows,
    creatorTotal,
    fee,
    listed,
    base,
    diff: base - listed,
    itemised: rows.filter((row) => !row.fee).length,
    rosterCount: creators.length,
  };
}

// Same campaign inclusion rule as web portal countsInMetrics().
export function campaignCountsInBillingMetrics(
  campaign: PortalCampaign
): boolean {
  const stage = (campaign.stage || "").toLowerCase();

  const countedStages = new Set([
    "live",
    "creator_paid",
    "reporting",
    "completed",
    "invoice_raised",
    "payment_done",
  ]);

  const creators = campaign.creators ?? [];

  const isPriced =
    billingNumber(campaign.budget) > 0 &&
    creators.some((creator) => billingNumber(creator.cost) > 0);

  const isLive = creators.some(
    (creator) =>
      Boolean(creator.live?.postUrl) ||
      (creator.live?.postUrls?.length ?? 0) > 0
  );

  return countedStages.has(stage) || (isLive && isPriced);
}

export type PortalBillingSummary = {
  campaigns: {
    campaign: PortalCampaign;
    billing: PortalCampaignBilling;
  }[];

  totalBudget: number;
  creatorTotal: number;
  agencyFee: number;
  allocated: number;
  remaining: number;
};

// Calculate brand-wide billing totals.
export function calculatePortalBilling(
  campaigns: PortalCampaign[]
): PortalBillingSummary {
  const included = campaigns.filter(campaignCountsInBillingMetrics);

  const details = included.map((campaign) => ({
    campaign,
    billing: calculateCampaignBilling(campaign),
  }));

  const totalBudget = details.reduce(
    (sum, item) => sum + item.billing.base,
    0
  );

  const creatorTotal = details.reduce(
    (sum, item) => sum + item.billing.creatorTotal,
    0
  );

  const agencyFee = details.reduce(
    (sum, item) => sum + item.billing.fee,
    0
  );

  const allocated = creatorTotal + agencyFee;

  return {
    campaigns: details,
    totalBudget,
    creatorTotal,
    agencyFee,
    allocated,
    remaining: totalBudget - allocated,
  };
}

// ---------------------------------------------
// PORTAL REELS / ASSETS
// ---------------------------------------------

export async function getPortalReels(
  scope: PortalScope
): Promise<PortalReel[]> {
  const query = buildScopeParams(scope);

  const data = await apiRequest<{ reels?: PortalReel[] }>(
    `/api/portal/reels?${query}`
  );

  return Array.isArray(data?.reels) ? data.reels : [];
}

// ---------------------------------------------
// PROFILE UPDATE
// ---------------------------------------------

export async function updatePortalProfile(
  id: string,
  patch: PortalProfilePatch
): Promise<PortalUser> {
  return apiRequest<PortalUser>(
    `/api/portal/account/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    }
  );
}

// ---------------------------------------------
// CHANGE PASSWORD
// ---------------------------------------------

export async function changePortalPassword(
  id: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiRequest<unknown>(
    `/api/portal/account/${encodeURIComponent(id)}/password`,
    {
      method: "POST",
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    }
  );
}

// ---------------------------------------------
// COMPANY DETAILS
// ---------------------------------------------

export async function getPortalClient(
  brandId: string
): Promise<PortalClient> {
  const params = new URLSearchParams();
  params.set("brand", brandId);

  return apiRequest<PortalClient>(
    `/api/portal/client?${params.toString()}`
  );
}

// ---------------------------------------------
// PROFILE AVATAR URL
// ---------------------------------------------

export function getPortalAvatarUrl(
  id: string,
  avatarUpdatedAt?: string | null
): string {
  const version = avatarUpdatedAt
    ? `?v=${encodeURIComponent(avatarUpdatedAt)}`
    : "";

  return `${getApiUrl()}/api/brand-credentials/${encodeURIComponent(
    id
  )}/avatar${version}`;
}

// ---------------------------------------------
// COMPANY LOGO URL
// ---------------------------------------------

export function getCompanyLogoUrl(
  brandId: string,
  avatarUpdatedAt?: string | null
): string {
  const version = avatarUpdatedAt
    ? `?v=${encodeURIComponent(avatarUpdatedAt)}`
    : "";

  return `${getApiUrl()}/api/clients/${encodeURIComponent(
    brandId
  )}/avatar${version}`;
}

export type InsightItem = {
  id: string;
  kind?: "reel" | "note";
  title?: string;
  text?: string;
  topic?: string;
  url?: string;
  link?: string;
  image?: string;
  source?: string;
  createdAt?: string;
  uploadedAt?: string;
  media?: {
    ok?: boolean;
    thumbnail?: string;
    video?: string;
    username?: string;
    caption?: string;
    views?: number | null;
    likes?: number | null;
    comments?: number | null;
  };
  [key: string]: any;
};

export type InsightFavourite = {
  itemId: string;
  itemType: "trending" | "market-watch";
};

export type PortalCommentInsights = {
  status?: "ready" | "running" | "error" | "none";
  generatedAt?: string;
  insight?: {
    totals?: {
      comments?: number;
      positive?: number;
      neutral?: number;
      negative?: number;
      spam?: number;
      posts?: number;
    };
    sentimentPct?: {
      positive?: number;
      neutral?: number;
      negative?: number;
    };
    timeline?: {
      date: string;
      positive: number;
      neutral: number;
      negative: number;
    }[];
    themes?: any[];
    negativeComments?: any[];
    purchaseQuotes?: any[];
    questions?: any[];
    [key: string]: any;
  } | null;
};

export type PortalQuestionAnswers = {
  whatWorked?: string;
  whatDidntWork?: string;
  nextActions?: string;
  areasToImprove?: string;
  [key: string]: any;
};

// Shared feed: same trending items for all brands.
export async function getPortalTrending(): Promise<InsightItem[]> {
  const data = await apiRequest<{ items?: InsightItem[] }>(
    "/api/portal/trending"
  );

  return Array.isArray(data?.items) ? data.items : [];
}

// Brand-specific questions.
export async function getPortalQuestions(
  scope: PortalScope
): Promise<PortalQuestionAnswers> {
  const query = buildScopeParams(scope);

  return apiRequest<PortalQuestionAnswers>(
    `/api/portal/questions?${query}`
  );
}

// Stored AI comment analysis. This GET must not trigger new analysis.
export async function getPortalCommentInsights(
  scope: PortalScope
): Promise<PortalCommentInsights> {
  const query = buildScopeParams(scope);

  return apiRequest<PortalCommentInsights>(
    `/api/portal/comment-insights?${query}`
  );
}

// Brand-specific Market Watch.
export async function getPortalMarketWatch(
  scope: PortalScope
): Promise<InsightItem[]> {
  const query = buildScopeParams(scope);

  const data = await apiRequest<{ items?: InsightItem[] }>(
    `/api/portal/market-watch?${query}`
  );

  return Array.isArray(data?.items) ? data.items : [];
}

// Shared news feed.
export async function getPortalNews(): Promise<InsightItem[]> {
  const data = await apiRequest<{ items?: InsightItem[] }>(
    "/api/portal/news"
  );

  return Array.isArray(data?.items) ? data.items : [];
}

// Brand-specific newsletter history.
export async function getPortalNewsletter(
  scope: PortalScope
): Promise<InsightItem[]> {
  const query = buildScopeParams(scope);

  const data = await apiRequest<{ items?: InsightItem[] }>(
    `/api/portal/newsletter?${query}`
  );

  return Array.isArray(data?.items) ? data.items : [];
}

// Favourites are only pointers to existing Trending / Market Watch items.
export async function getPortalFavourites(
  scope: PortalScope
): Promise<InsightFavourite[]> {
  const query = buildScopeParams(scope);

  const data = await apiRequest<{ items?: InsightFavourite[] }>(
    `/api/portal/favourites?${query}`
  );

  return Array.isArray(data?.items) ? data.items : [];
}

// Toggle favourite on the backend.
export async function togglePortalFavourite(
  scope: PortalScope,
  itemId: string,
  itemType: "trending" | "market-watch"
): Promise<{ itemId: string; itemType: string; favourited: boolean }> {
  return apiRequest(
    "/api/portal/favourites",
    {
      method: "POST",
      body: JSON.stringify({
        brand: scope.brandId,
        client: scope.clientName,
        itemId,
        itemType,
      }),
    }
  );
}

// Newsletter download URL. Keep brand scope in the URL because
// the backend validates the brand on every file request.
export function getPortalNewsletterFileUrl(
  id: string,
  scope: PortalScope
): string {
  return `${getApiUrl()}/api/portal/newsletter/${encodeURIComponent(
    id
  )}/file?${buildScopeParams(scope)}`;
}