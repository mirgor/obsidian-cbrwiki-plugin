import { App, Editor, MarkdownView, MarkdownRenderer, Modal, Notice, Plugin, PluginSettingTab, Setting, parseYaml, stringifyYaml, request } from 'obsidian';
import { Remarkable, escapeHtml } from 'remarkable';
import wikilink from 'remarkable-wikilink';


//for redefine remarkable-wikilink functions 
const HTML_ESCAPE_TEST_RE = /[&<>"]/;
const HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
const HTML_REPLACEMENTS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
};
function replaceUnsafeChar(ch: string) {
	return HTML_REPLACEMENTS[ch];
}
function escapeHtml(str: string) {
	if (HTML_ESCAPE_TEST_RE.test(str)) {
		return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar);
	}
	return str;
}

const md = new Remarkable('full');
md.set({
	html: true,
	breaks: true,
	typographer: true,
	quotes: '“”‘’'
  });
md.use(wikilink);
md.renderer.rules.wikilink_open = function (tokens, idx, options /*, env */) {
		return `<a href="/wiki/${escapeHtml(encodeURIComponent(tokens[idx].href))}" class="wikilink">`;
	};

console.log(md.render(`This is a [[Test]].`));





interface CbrWikiSettings {
	cbrUrl: string,
	username: string,
	password: string,
	xBrowserId: string,
	KeyJWT: string
}

const DEFAULT_SETTINGS: CbrWikiSettings = {
	cbrUrl: '',
	username: '',
	password: '',
	xBrowserId: 'fr45654fgf-b622-2cc0b14369e2d3-09',
	KeyJWT: ''
}

export default class CbrWiki extends Plugin {
	settings: CbrWikiSettings;
	
	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconWikiGet = this.addRibbonIcon('down-arrow-with-tail', 'CbrWiki. Get Article', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			this.cbrWikiArticle(`download`);
		});
		// Perform additional things with the ribbon
		ribbonIconWikiGet.addClass('cbrwiki-plugin-ribbon-class');

		const ribbonIconWikiPut = this.addRibbonIcon('up-arrow-with-tail', 'CbrWiki. Put Article', (evt: MouseEvent) => {
			this.cbrWikiArticle(`upload`); 
		});
		ribbonIconWikiPut.addClass('cbrwiki-plugin-ribbon-class');



		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('CbrWiki 🧐');

		// // This adds a simple command that can be triggered anywhere
		// this.addCommand({
		// 	id: 'open-sample-modal-simple',
		// 	name: 'Open sample modal (simple)',
		// 	callback: () => {
		// 		new SampleModal(this.app).open();
		// 	}
		// });
		// // This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: 'sample-editor-command',
		// 	name: 'Sample editor command',
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		console.log(editor.getSelection());
		// 		editor.replaceSelection('Sample Editor Command');
		// 	}
		// });
		// // This adds a complex command that can check whether the current state of the app allows execution of the command
		// this.addCommand({
		// 	id: 'open-sample-modal-complex',
		// 	name: 'Open sample modal (complex)',
		// 	checkCallback: (checking: boolean) => {
		// 		// Conditions to check
		// 		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		// 		if (markdownView) {
		// 			// If checking is true, we're simply "checking" if the command can be run.
		// 			// If checking is false, then we want to actually perform the operation.
		// 			if (!checking) {
		// 				new SampleModal(this.app).open();
		// 			}

		// 			// This command will only show up in Command Palette when the check function returns true
		// 			return true;
		// 		}
		// 	}
		// });

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	async onunload() {
		await this.loadSettings();
		this.settings.KeyJWT = '';
	}

	/****
	 * CbrWiki. Download/upload Article
	 * 
	 */
	async cbrWikiArticle(action = `download`){
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const cbrUrl = this.settings.cbrUrl;
		if (view){
			const mode =  view.getState().mode;
			if (view.editor && mode === `source`) {
				//get current article filename (title)
				const activeFileView = app.workspace.getActiveFileView();
				const title = activeFileView.file.basename;
				//test connect to CBR
				//const KeyJWT = await this._getCbrAccessToken();
				this.settings.KeyJWT = await this._getCbrAccessToken();
				
				if(this.settings.KeyJWT) {
					const cbrWiki = await this._getCbr(this.settings.KeyJWT, `${cbrUrl}/api/rest.php/wiki/${title}`);

					if (action === `download`){
						view.editor.setValue(cbrWiki.content);
						new Notice(`Article "${title}" has been downloaded ⬇️`, 1500);				
					}

					if (action === `upload`){
						const obsContent = view.editor.getValue();

						

						// // == With Use MarkdownRenderer from Obsidian ==
						// const htmlEL =  document.createElement('div');
						// await MarkdownRenderer.renderMarkdown(obsContent, htmlEL, '', null);
						// const htmlContent = htmlEL.innerHTML;

						// == With Use 'remarkable' ==
						const htmlContent = md.render(obsContent);
						
						const url = `${cbrUrl}/api/v2/wiki/update/${cbrWiki.id}`;
						const data = {
								"id": cbrWiki.id,
								"title": title,
								"content": obsContent,
								"html": htmlContent
							};
						
						await this._putCbr(this.settings.KeyJWT, url, data);
						new Notice(`Article "${title}" has been uploaded ⬆️`, 1500);
					}

					if (action === `test`){
						let obsContent = view.editor.getValue();
						console.log(obsContent);
						
		
						// /**** 
						//  * Parse the YAML frontmatter
						//  *    const frontmatter = parseYaml(obsContent.split('---')[1]);
						//  * alternative
						//  *    const frontmatter = JSON.parse(activeFileView.lastFrontmatter);
						//  *	- this added keys "position:"
						//  */
						// const frontmatter = parseYaml(obsContent.split('---')[1]);
						// // Update the variables
						// // frontmatter.owner = frontmatter.owner||null;
						// // frontmatter.type = frontmatter.type||'info';
						// // frontmatter.aliases = frontmatter.aliases||'';
		
						// // Convert the updated object back to a YAML string
						// const updatedYaml = '---\n' + stringifyYaml(frontmatter) + '---\n';
		
						// // Replace the original YAML front matter with the updated YAML string
						// obsContent = obsContent.replace(/---[\s\S]*?---/, updatedYaml);
						
						/**** 
						 * Set absolute URL for cbr-attachments 
						 */
						const absoluteURL = `](${cbrUrl}/s3/` ;
						obsContent = obsContent.replace(/\]\(\/s3\//, absoluteURL);
						view.editor.setValue(obsContent);
					}
				}

			} else {
				new Notice(`Warning! Markdown edit mode is needed!`);
			}
		} 
	}

	async _getCbrAccessToken(){
		const xBrowserId = this.settings.xBrowserId;
		const username = this.settings.username;
		const password = this.settings.password;
		const cbrUrl = this.settings.cbrUrl;
		const payload = {"email": username,"password": password,"browser_id": xBrowserId};

		try {
			const response = JSON.parse(await request({
				url: cbrUrl + `/api/rest.php/auth/session`,
				method: "POST",
				contentType: "application/json;charset=UTF-8",
				body: JSON.stringify(payload),
				headers: {
					'x-browser-id': xBrowserId,
				}
			}));
			if (response.jwt_token) {
				return response.jwt_token;
			} else {
				throw new Error("Failed to obtain JWT token");
			}
		} catch (error) {
			new Notice(`Error occurred during _getCbrAccessToken ${error}`);
			console.error("Error occurred during _getCbrAccessToken:", error);
			return null;
		}
	}

	async _getCbr(KeyJWT: string, urlRequest: string) {
		const xBrowserId = this.settings.xBrowserId;
		try {
			const response = JSON.parse(await request({
				url: urlRequest,
				method: "GET",
				headers: {
					'Authorization': `Bearer ${KeyJWT}`,
					'Content-Type': `application/json;charset=UTF-8`,
					'x-browser-id': xBrowserId
				},
			}));
			if (response) {
				return response;
			} else {
				throw new Error(`Failed to obtain ${urlRequest}`);
			}
		} catch (error) {
			new Notice(`Error occurred during _getCbr ${error}`);
			console.error(`Error occurred during _getCbr ${urlRequest}:`, error);
			return null;
		}
	}

	async _putCbr(KeyJWT: string, urlRequest: string, data: object) {
		const xBrowserId = this.settings.xBrowserId;
		try {
			const response = JSON.parse(await request({
				url: urlRequest,
				method: "PUT",
				headers: {
				'Authorization': `Bearer ${KeyJWT}`,
				'Content-Type': `application/json;charset=UTF-8`,
				'x-browser-id': xBrowserId
				},
				body: JSON.stringify(data)
			}));
			if (response) {
				return response;
			} else {
				throw new Error(`Failed to put ${urlRequest}`);
			}
		} catch (error) {
			new Notice(`Error occurred during _putCbr ${error}`);
			console.error("Error occurred during _putCbr:", error);
			return null;
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: CbrWiki;

	constructor(app: App, plugin: CbrWiki) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'CbrWiki. Settings'});

		new Setting(containerEl)
			.setName('URL of LMS Collaborator domain')
			.setDesc('Example: https://mysite.com')
			.addText(text => text
				.setPlaceholder('Enter your domain URL')
				.setValue(this.plugin.settings.cbrUrl)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.cbrUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('User')
			.setDesc('Login or e-mail')
			.addText(text => text
				.setPlaceholder('Enter your Login or e-mail')
				.setValue(this.plugin.settings.username)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.username = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Password')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your password')
				.setValue(this.plugin.settings.password)
				.onChange(async (value) => {
					this.plugin.settings.password = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('xBrowserId')
			.setDesc('Like as fr45654fgf-b622-2cc0b1436')
			.addText(text => text
				.setPlaceholder('Enter your xBrowserId')
				.setValue(this.plugin.settings.xBrowserId)
				.onChange(async (value) => {
					this.plugin.settings.xBrowserId = value;
					await this.plugin.saveSettings();
				}));
	}
}
