import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Ticket {
  title: string;
  userStory: string;
  acceptanceCriteria: string[];
  priority: "High" | "Medium" | "Low";
}

function generateMarkdown(ticket: Ticket): string {
  return `# ${ticket.title}

**Priority:** ${ticket.priority}

## User Story

${ticket.userStory}

## Acceptance Criteria

${ticket.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}
`;
}

function encodeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
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
    const { ticket, owner, repo, pat } = await req.json();

    if (!ticket || !owner || !repo || !pat) {
      return new Response(JSON.stringify({ error: "Missing required fields: ticket, owner, repo, pat" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const markdown = generateMarkdown(ticket);
    const filename = `tickets/${ticket.title.replace(/[^a-zA-Z0-9-\s]/g, "").replace(/\s+/g, "-")}.md`;
    const base64Content = encodeBase64(markdown);

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filename)}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${pat}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          "User-Agent": "SpecDrop",
        },
        body: JSON.stringify({
          message: `Add ticket: ${ticket.title}`,
          content: base64Content,
          branch: "main",
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || `GitHub API error: ${response.status}`;
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify({
      success: true,
      url: data.content?.html_url,
      filename,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
