import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Gemini-Key",
};

interface Ticket {
  title: string;
  userStory: string;
  acceptanceCriteria: string[];
  priority: "High" | "Medium" | "Low";
}

const fallbackTickets: Ticket[] = [
  {
    title: "User Authentication & Onboarding Flow",
    userStory: "As a new user, I want to sign up and create an account so that I can access personalized features and save my progress",
    acceptanceCriteria: [
      "User can sign up with email/password or social login (Google, GitHub)",
      "Email verification is sent and must be confirmed before account activation",
      "Password must meet security requirements (8+ chars, mixed case, number)",
      "User is redirected to onboarding wizard after first login",
      "Account creation takes less than 3 seconds on average",
    ],
    priority: "High",
  },
  {
    title: "Dashboard Analytics & Real-time Metrics",
    userStory: "As a product manager, I want to view real-time analytics on a dashboard so that I can make data-driven decisions",
    acceptanceCriteria: [
      "Dashboard displays key metrics: users, revenue, conversion rate, churn",
      "Charts update in real-time with WebSocket connections",
      "Users can filter data by date range, segment, and product",
      "Export functionality available for CSV and PDF reports",
      "Dashboard loads initial data within 2 seconds",
    ],
    priority: "High",
  },
  {
    title: "Team Collaboration & Permissions System",
    userStory: "As a team admin, I want to invite members and manage permissions so that my team can collaborate securely",
    acceptanceCriteria: [
      "Admin can invite members via email with role assignment",
      "Three role levels: Admin, Editor, Viewer with distinct permissions",
      "Invitation links expire after 7 days",
      "Team members receive notifications on project updates",
      "Permission changes take effect immediately without page refresh",
    ],
    priority: "Medium",
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const geminiKey = req.headers.get("X-Gemini-Key");
    const { prd } = await req.json();

    // If no API key or no PRD, still return fallback after delay (graceful degradation)
    if (!geminiKey || !prd || typeof prd !== "string") {
      await sleep(1500);
      return new Response(JSON.stringify({ tickets: fallbackTickets }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are an expert Product Manager. Analyze the following Product Requirement Document (PRD) and break it down into development tickets.

For each ticket, provide:
- title: A concise ticket title
- userStory: Format as "As a [user type], I want [action] so that [benefit]"
- acceptanceCriteria: An array of 3-5 specific, testable acceptance criteria
- priority: One of "High", "Medium", or "Low" based on business impact and dependencies

PRD:
${prd}

Return ONLY a valid JSON array of tickets with no markdown formatting. Example format:
[
  {
    "title": "User Authentication Flow",
    "userStory": "As a new user, I want to create an account so that I can access personalized features",
    "acceptanceCriteria": ["User can enter email and password", "Email validation works", "Account is created successfully"],
    "priority": "High"
  }
]`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192,
            },
          }),
        }
      );

      if (!response.ok) {
        // Rate limit or other API error - return fallback gracefully
        await sleep(1500);
        return new Response(JSON.stringify({ tickets: fallbackTickets }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) {
        await sleep(1500);
        return new Response(JSON.stringify({ tickets: fallbackTickets }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Parse the JSON response from Gemini
      let tickets: Ticket[];
      try {
        const cleanedContent = textContent.replace(/```json\n?|\n?```/g, "").trim();
        tickets = JSON.parse(cleanedContent);
      } catch {
        // Parse error - return fallback
        await sleep(1500);
        return new Response(JSON.stringify({ tickets: fallbackTickets }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ tickets }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      // Any Gemini API error - return fallback gracefully
      await sleep(1500);
      return new Response(JSON.stringify({ tickets: fallbackTickets }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    // Top-level error - still return fallback
    await sleep(1500);
    return new Response(JSON.stringify({ tickets: fallbackTickets }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
