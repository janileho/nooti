type WriteContentParams = {
  owner: string;
  repo: string;
  branch?: string;
  token: string;
  path: string;
  message: string;
  content: string; // raw text, will be base64-encoded
};

async function getFileShaIfExists(params: Omit<WriteContentParams, "message" | "content">) {
  const branch = params.branch || "main";
  const res = await fetch(
    `https://api.github.com/repos/${params.owner}/${params.repo}/contents/${encodeURIComponent(
      params.path
    )}?ref=${encodeURIComponent(branch)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN || ""}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
  const json = (await res.json()) as { sha?: string };
  return json.sha || null;
}

export async function writeRepoFile(params: WriteContentParams) {
  const branch = params.branch || "main";
  const sha = await getFileShaIfExists({
    owner: params.owner,
    repo: params.repo,
    branch,
    token: params.token,
    path: params.path,
  });

  const resp = await fetch(
    `https://api.github.com/repos/${params.owner}/${params.repo}/contents/${encodeURIComponent(
      params.path
    )}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: params.message,
        content: Buffer.from(params.content, "utf8").toString("base64"),
        branch,
        sha: sha || undefined,
      }),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub write failed: ${resp.status} - ${text}`);
  }
}

