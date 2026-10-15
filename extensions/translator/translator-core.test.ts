import { describe, expect, test } from "bun:test";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfm } from "micromark-extension-gfm";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { isControlInput, prepareTranslation, TranslationProtectionError } from "./translator-core";

const parse = (source: string) => fromMarkdown(source, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
const translated = (source: string, pairs: Record<string, string>) => {
	const plan = prepareTranslation(source);
	return plan.restore(plan.units.map(unit => pairs[unit.text] ?? unit.text));
};

describe("parser-backed Markdown translation", () => {
	test("preserves nested prefixes, CRLF, emphasis, escapes and entities", () => {
		const source = "> - **Hello**\r\n>   next &amp; \\* text  \r\n>   last\r\n";
		expect(translated(source, { Hello: "你好", next: "接著", text: "文字", last: "最後" }))
			.toBe("> - **你好**\r\n>   接著 &amp; \\* 文字  \r\n>   最後\r\n");
	});

	test("preserves GFM table cells, tasks and all code bytes", () => {
		const source = "- [x] Ready\n\n| Status | Command |\n|:---|---:|\n| Ready | `ssh router1` |\n\n```sh\necho 'Do not translate'\n```\n";
		const result = translated(source, { Ready: "就緒", Status: "狀態", Command: "指令" });
		expect(result).toBe("- [x] 就緒\n\n| 狀態 | 指令 |\n|:---|---:|\n| 就緒 | `ssh router1` |\n\n```sh\necho 'Do not translate'\n```\n");
		expect(parse(result).children.map(node => node.type)).toEqual(["list", "table", "code"]);
	});

	test("translates explicit labels without changing URLs, reference IDs or images", () => {
		const source = "Read [details](https://example.com/a_(b) \"Title\") and [guide][ref].\n\n[ref]: /guide.md \"Literal\"\n\n[ref] [ref][] <https://example.com> ![Image #1](image.png)\n";
		expect(translated(source, { Read: "閱讀", details: "詳情", and: "以及", guide: "指南" }))
			.toBe("閱讀 [詳情](https://example.com/a_(b) \"Title\") 以及 [指南][ref].\n\n[ref]: /guide.md \"Literal\"\n\n[ref] [ref][] <https://example.com> ![Image #1](image.png)\n");
	});

	test("uses UTF-16 positions correctly after non-BMP characters", () => {
		const source = "🧪 中文 **Hello** `原始碼` and [details](https://example.com)";
		expect(translated(source, { Hello: "你好", and: "以及", details: "詳情" }))
			.toBe("🧪 中文 **你好** `原始碼` 以及 [詳情](https://example.com)");
	});

	test("contractions and punctuated slash compounds remain translatable", () => {
		const source = "That's a bug/limit; the host's pipeline can't fix it.";
		const plan = prepareTranslation(source);
		expect(plan.restore(plan.units.map(() => "這是限制，無法修復。"))).toBe("這是限制，無法修復。");
	});

	test.each([
		["100 MB/file (4 parts)", "100 MB/個檔案（4 個部分）"],
		["Alpha/Beta stays on stage2", "Alpha/Beta仍在stage2"],
		["(IP type/reputation) when serving", "（IP類型/聲譽）於服務時"],
		["backup/rollback and MB/s", "備份/回滾功能（修復中），MB/s）"],
		["Alpha/Beta, Gamma One", "Alpha/Beta、Gamma One"],
		["the app (Alpha/Beta, Gamma One)", "應用程式（Alpha/Beta、Gamma One）"],
		["BOOT/RESET, Pointers/structs", "BOOT/RESET、指針/結構體、cJSON"],
	])("accepts slash-compound translations: %s", (source, target) => {
		const plan = prepareTranslation(source);
		expect(plan.units).toEqual([{ text: source }]);
		const tree = parse(plan.restore([target]));
		const paragraph = tree.children[0];
		if (paragraph.type !== "paragraph" || paragraph.children[0].type !== "text") throw new Error("Lost prose");
		expect(paragraph.children[0].value).toBe(target);
	});

	test.each([
		["process/app rules are deliberate per-device behavior — kept as-is)", "處理/應用程式規則是刻意的逐裝置行為——維持不變。"],
		["slash compounds before Han mid-sentence", "處理/應用程式、備份/回滾都正常。"],
		// Same class in Arabic: candidates end at spaces, but Arabic punctuation (،؛) must not
		// break the two-word shape either.
		["backup/rollback works well", "النسخ/الاستعادة تعمل بشكل جيد، شكراً."],
		["read/write mode", "وضع القراءة/الكتابة؛ مفيد"],
	])("accepts slash compounds in translated prose (any script): %s", (source, target) => {
		const plan = prepareTranslation(source);
		const tree = parse(plan.restore([target]));
		const paragraph = tree.children[0];
		if (paragraph.type !== "paragraph" || paragraph.children[0].type !== "text") throw new Error("Lost prose");
		expect(paragraph.children[0].value).toBe(target);
	});

	test("keeps multi-slash ASCII paths protected while prose slashes translate", () => {
		const plan = prepareTranslation("Extract to usr/local/bin and read docs/guide.");
		expect(plan.units.map(unit => unit.text)).toEqual(["Extract to", "and read"]);
		expect(plan.restore(["解壓到", "並閱讀"])).toBe("解壓到 usr/local/bin 並閱讀 docs/guide.");
	});

	test("keeps strong nodes when translated punctuation changes closer flanking", () => {
		const result = translated("**Every segment stays intact**. A reply has many.", {
			"Every segment stays intact": "每個片段都保持完整。",
			". A reply has many.": "29行內容。",
		});
		expect(result).toBe("**每個片段都保持完整。**&#50;9行內容。");
		const paragraph = parse(result).children[0];
		if (paragraph.type !== "paragraph") throw new Error("Lost paragraph");
		expect(paragraph.children.map(node => node.type)).toEqual(["strong", "text"]);
	});

	test("retains separate strong and emphasis nodes from the recorded failure", () => {
		const result = translated("Use **small models**. Their fix uses *alignments*.", {
			Use: "使用",
			"small models": "小型模型。",
			". Their fix uses": "他們使用",
			alignments: "對齊方式",
		});
		const paragraph = parse(result).children[0];
		if (paragraph.type !== "paragraph") throw new Error("Lost paragraph");
		expect(paragraph.children.map(node => node.type)).toEqual(["text", "strong", "text", "emphasis", "text"]);
	});

	test("handles opener flanking and ordinary untranslated digits without added whitespace", () => {
		expect(translated("Lead:**word**", { "Lead:": "前言", word: "「詞」" }))
			.toBe("前&#35328;**「詞」**");
		expect(translated("**Ready**29", { Ready: "就緒。" })).toBe("**就緒。**&#50;9");
		expect(translated("**Ready**𝟙**Next**", { Ready: "就緒。", Next: "下一個" }))
			.toBe("**就緒。**&#120793;**下一個**");
	});

	test("fails closed when flanking would require changing a protected path", () => {
		const plan = prepareTranslation("**Ready**config.json");
		expect(() => plan.restore(["就緒。"])).toThrow(TranslationProtectionError);
	});

	test("retains explicit paths and rejects genuinely introduced technical literals", () => {
		const source = "Edit /tmp/資料 src/資料 中文/config.yaml foo/bar1 now";
		expect(translated(source, { Edit: "編輯", now: "現在" }))
			.toBe("編輯 /tmp/資料 src/資料 中文/config.yaml foo/bar1 現在");
		for (const literal of ["/tmp/資料", "src/資料", "中文/config.yaml", "foo/bar1", "https://example.test", "--danger", "CONFIG_PATH"]) {
			expect(() => prepareTranslation("Hello").restore([`新增 ${literal}`])).toThrow(TranslationProtectionError);
		}
	});

	test("keeps technical literals and unformatted shell commands intact", () => {
		const source = "Edit '/Users/alice/a b/config.yaml' and config.json on 192.168.50.1 with --dry-run.\n\nssh router1 'uname -a'\n";
		expect(translated(source, { Edit: "編輯", and: "以及", on: "位於", with: "使用" }))
			.toBe("編輯 '/Users/alice/a b/config.yaml' 以及 config.json 位於 192.168.50.1 使用 --dry-run.\n\nssh router1 'uname -a'\n");
	});

	test("model punctuation cannot inject links, HTML, lists or table columns", () => {
		const result = translated("| Label |\n|---|\n| Value |\n", { Value: "[click](target) | <br>" });
		const tree = parse(result);
		const table = tree.children[0];
		if (table.type !== "table") throw new Error("Translation changed the table");
		expect(table.children[1].children).toHaveLength(1);
		const children = table.children[1].children[0].children;
		expect(children.map(node => node.type)).toEqual(["text"]);
		if (children[0].type !== "text") throw new Error("Translation introduced markup");
		expect(children[0].value).toBe("[click](target) | <br>");
	});

	test("code-only documents restore without any translation", () => {
		const source = "```json\n{\"message\":\"hello\"}\n```\n\n    ssh router1\n";
		expect(prepareTranslation(source).restore([])).toBe(source);
	});

	test("missing text and control characters fail without partial restoration", () => {
		const plan = prepareTranslation("**Hello** `code` world");
		expect(() => plan.restore(["你好"])).toThrow(TranslationProtectionError);
		expect(() => plan.restore(["你好", ""])).toThrow(TranslationProtectionError);
		expect(() => plan.restore(["你好", "世界\u001b[31m"])).toThrow(TranslationProtectionError);
		expect(() => plan.restore(["你好", "https://evil.test"])).toThrow(TranslationProtectionError);
	});

	test("existing control inputs retain their bypass behavior", () => {
		for (const input of ["/model", "!echo hi", "$ pwd", "-> next", "=> later", ".", "c"]) expect(isControlInput(input)).toBe(true);
		expect(isControlInput("Please explain this command.")).toBe(false);
	});
});
