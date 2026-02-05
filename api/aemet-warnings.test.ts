import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWarningSignal,
  extractXmlDocuments,
  extractXmlDocumentsFromTarBuffer,
  isRelevantWarning,
  isWarningActive,
  parseCapXml,
} from "./aemet-warnings";

function writeAsciiField(target: Uint8Array, start: number, size: number, value: string): void {
  const bytes = new TextEncoder().encode(value);
  target.set(bytes.subarray(0, size), start);
}

function buildTar(entries: Array<{ name: string; content: string }>): ArrayBuffer {
  const chunks: Uint8Array[] = [];

  for (const entry of entries) {
    const contentBytes = new TextEncoder().encode(entry.content);
    const header = new Uint8Array(512);

    writeAsciiField(header, 0, 100, entry.name);
    writeAsciiField(header, 100, 8, "0000777\0");
    writeAsciiField(header, 108, 8, "0000000\0");
    writeAsciiField(header, 116, 8, "0000000\0");
    writeAsciiField(header, 124, 12, `${contentBytes.length.toString(8).padStart(11, "0")}\0`);
    writeAsciiField(header, 136, 12, "00000000000\0");
    writeAsciiField(header, 156, 1, "0");

    chunks.push(header, contentBytes);

    const padding = (512 - (contentBytes.length % 512)) % 512;
    if (padding > 0) {
      chunks.push(new Uint8Array(padding));
    }
  }

  chunks.push(new Uint8Array(1024)); // TAR EOF (two empty 512-byte blocks)

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output.buffer;
}

test("parseCapXml extracts fenomeno and zone using named CAP fields", () => {
  const xml = `
    <alert>
      <info>
        <eventCode>
          <valueName>Meteoalerta nivel</valueName>
          <value>amarillo</value>
        </eventCode>
        <eventCode>
          <valueName>Meteoalerta tipo de fenomeno</valueName>
          <value>VI;Vientos</value>
        </eventCode>
        <geocode>
          <valueName>UGC</valueName>
          <value>722802</value>
        </geocode>
        <onset>2026-02-05T08:00:00Z</onset>
        <expires>2026-02-05T20:00:00Z</expires>
        <severity>Moderate</severity>
      </info>
    </alert>
  `;

  const warnings = parseCapXml(xml);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].fenomeno, "VI;Vientos");
  assert.equal(warnings[0].zona, "722802");
  assert.equal(warnings[0].nivel, "moderate");
});

test("isRelevantWarning accepts Retiro zone and wind/snow codes", () => {
  assert.equal(
    isRelevantWarning({
      fenomeno: "VI;Vientos",
      zona: "722801 722802",
    }),
    true
  );

  assert.equal(
    isRelevantWarning({
      fenomeno: "TC;Temperaturas maximas",
      zona: "722802",
    }),
    false
  );
});

test("isWarningActive rejects future, expired and invalid timestamps", () => {
  const now = new Date("2026-02-05T12:00:00Z");

  assert.equal(
    isWarningActive(
      {
        onset: "2026-02-05T13:00:00Z",
        expires: "2026-02-05T15:00:00Z",
      },
      now
    ),
    false
  );

  assert.equal(
    isWarningActive(
      {
        onset: "2026-02-05T08:00:00Z",
        expires: "2026-02-05T11:00:00Z",
      },
      now
    ),
    false
  );

  assert.equal(
    isWarningActive(
      {
        onset: "not-a-date",
        expires: "2026-02-05T15:00:00Z",
      },
      now
    ),
    false
  );

  assert.equal(
    isWarningActive(
      {
        onset: "2026-02-05T08:00:00Z",
        expires: "2026-02-05T15:00:00Z",
      },
      now
    ),
    true
  );
});

test("extractXmlDocumentsFromTarBuffer returns only CAP alert documents", () => {
  const tar = buildTar([
    { name: "alert-1.xml", content: `<alert><info><eventCode><value>VI;Vientos</value></eventCode></info></alert>` },
    { name: "readme.txt", content: `not xml` },
    { name: "alert-2.xml", content: `<alert><info><eventCode><value>NE;Nevadas</value></eventCode></info></alert>` },
  ]);

  const docs = extractXmlDocumentsFromTarBuffer(tar);
  assert.equal(docs.length, 2);
  assert.match(docs[0], /VI;Vientos/);
  assert.match(docs[1], /NE;Nevadas/);
});

test("extractXmlDocuments falls back to plain XML payloads", () => {
  const xml = `<alert><info><eventCode><value>VI;Vientos</value></eventCode></info></alert>`;
  const payload = new TextEncoder().encode(xml);
  const docs = extractXmlDocuments(payload.buffer, "application/xml");

  assert.equal(docs.length, 1);
  assert.match(docs[0], /<alert>/);
});

test("buildWarningSignal flags active warnings for Retiro zone", () => {
  const now = new Date("2026-02-05T12:00:00Z");
  const signal = buildWarningSignal(
    [
      {
        fenomeno: "VI;Vientos",
        zona: "722802",
        onset: "2026-02-05T10:00:00Z",
        expires: "2026-02-05T18:00:00Z",
        nivel: "severe",
      },
    ],
    now
  );

  assert.equal(signal.hasActiveWarning, true);
  assert.equal(signal.activeWarningSeverity, "severe");
  assert.equal(signal.hasWarningWithin2Hours, false);
  assert.equal(signal.hasWarningLaterToday, false);
});

test("buildWarningSignal classifies soon warnings within 2h", () => {
  const now = new Date("2026-02-05T12:00:00Z");
  const signal = buildWarningSignal(
    [
      {
        fenomeno: "VI;Vientos",
        zona: "722802",
        onset: "2026-02-05T13:00:00Z",
        expires: "2026-02-05T19:00:00Z",
        nivel: "moderate",
      },
    ],
    now
  );

  assert.equal(signal.hasActiveWarning, false);
  assert.equal(signal.hasWarningWithin2Hours, true);
  assert.equal(signal.hasWarningLaterToday, false);
  assert.equal(signal.nextWarningSeverity, "moderate");
});

test("buildWarningSignal classifies later-today warnings outside 2h", () => {
  const now = new Date("2026-02-05T12:00:00Z");
  const signal = buildWarningSignal(
    [
      {
        fenomeno: "VI;Vientos",
        zona: "722802",
        onset: "2026-02-05T18:00:00Z",
        expires: "2026-02-05T21:00:00Z",
        nivel: "moderate",
      },
    ],
    now
  );

  assert.equal(signal.hasActiveWarning, false);
  assert.equal(signal.hasWarningWithin2Hours, false);
  assert.equal(signal.hasWarningLaterToday, true);
});
