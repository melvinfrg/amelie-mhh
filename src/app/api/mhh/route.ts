import { extractText, getDocumentProxy } from "unpdf";

// Temporary: shows the raw source text so the parser can be written against it.
const PAGES: Record<string, string> = {
  vorlesungszeiten: "https://www.mhh.de/vorlesungszeiten",
  termine: "https://www.mhh.de/studierendensekretariat/termine-fristen",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("raw") ?? "vorlesungszeiten";
  if (raw === "pdf") {
    const sj = url.searchParams.get("sj") ?? "1";
    const res = await fetch(
      `https://www.mhh.de/fileadmin/mhh/medizin-studiengang/downloads/Curriula/2026_2027/MHH_Medizin_Pr%C3%BCfungen_2026_2027_Liste_SJ_${sj}.pdf`,
    );
    const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
    const out: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if ("str" in item) out.push(`${p}\t${Math.round(item.transform[4])}\t${Math.round(item.transform[5])}\t${item.str}`);
      }
    }
    const { text } = await extractText(pdf, { mergePages: true });
    return new Response(out.join("\n") + "\n\n=====\n" + text, { headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const res = await fetch(PAGES[raw]);
  const html = await res.text();
  const start = html.indexOf("<main");
  return new Response(html.slice(start >= 0 ? start : 0), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
