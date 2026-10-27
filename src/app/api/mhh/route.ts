import { getDocumentProxy } from "unpdf";
import {
  academicYear,
  examListUrls,
  parseExamList,
  parseLecturePeriods,
  parseRegistration,
  SOURCES,
  type PdfItem,
  type Suggestion,
} from "@/lib/mhh";

// mhh.de changes rarely; the pages are fetched again every six hours.
const REVALIDATE = 6 * 60 * 60;

async function page(url: string) {
  const res = await fetch(url, { next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

async function examList(year: string, studyYear: number) {
  for (const url of examListUrls(year, studyYear)) {
    const res = await fetch(url, { next: { revalidate: REVALIDATE } });
    if (!res.ok) continue;
    const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
    const items: PdfItem[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const content = await (await pdf.getPage(p)).getTextContent();
      for (const item of content.items) {
        if ("str" in item) items.push({ page: p, row: Math.round(item.transform[4]), col: Math.round(item.transform[5]), text: item.str });
      }
    }
    return { url, suggestions: parseExamList(items, studyYear, year) };
  }
  return null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const studyYear = Math.min(6, Math.max(1, Number(params.get("sj")) || 1));
  const year = academicYear();
  const errors: string[] = [];
  const links: { label: string; url: string }[] = [
    { label: "Vorlesungszeiten", url: SOURCES.lectures },
    { label: "Termine und Fristen", url: SOURCES.registrar },
  ];

  const [lectures, registration, exams] = await Promise.all([
    page(SOURCES.lectures).then(parseLecturePeriods, (e) => (errors.push(`Vorlesungszeiten: ${e.message}`), [])),
    page(SOURCES.registrar).then((html) => parseRegistration(html), (e) => (errors.push(`Rückmeldung: ${e.message}`), [])),
    examList(year, studyYear).catch((e) => (errors.push(`Prüfungsliste: ${e.message}`), null)),
  ]);
  if (exams) links.push({ label: `Prüfungsliste ${studyYear}. Studienjahr`, url: exams.url });
  else errors.push(`Für das ${studyYear}. Studienjahr ${year.replace("_", "/")} ist noch keine Prüfungsliste veröffentlicht.`);

  const suggestions: Suggestion[] = [...lectures, ...registration, ...(exams?.suggestions ?? [])];
  return Response.json(
    { studyYear, academicYear: year.replace("_", "/"), suggestions, errors, links },
    { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
