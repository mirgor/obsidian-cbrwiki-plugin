import { App, Editor, MarkdownView, MarkdownRenderer, Modal, Notice, Plugin, PluginSettingTab, Setting, parseYaml, stringifyYaml, request } from 'obsidian';
// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	
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



		// // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText('Status Bar Text');

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

	onunload() {

	}

	/****
	 * CbrWiki. Download/upload Article
	 * 
	 */
	async cbrWikiArticle(action = `download`){
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		// const cbrUrl = `https://demotour.davintoo.com`;
		const cbrUrl = `https://home.cbr.rocks`;
		if (view){
			const mode =  view.getState().mode;
			if (view.editor && mode === `source`) {
				//get current article filename (title)
				const activeFileView = app.workspace.getActiveFileView();
				const title = activeFileView.file.basename;
				//test connect to CBR
				const KeyJWT = await this._getCbrAccessToken();
				//new Notice(`This is a notice! ${KeyJWT}`);
				const cbrWiki = await this._getCbr(KeyJWT, `${cbrUrl}/api/rest.php/wiki/${title}`);

				if (action === `download`){
					view.editor.setValue(cbrWiki.content);
				}

				if (action === `upload`){
					const obsContent = view.editor.getValue();
					const htmlEL =  document.createElement('div');
					await MarkdownRenderer.renderMarkdown(obsContent, htmlEL, '', null)
					const url = `${cbrUrl}/api/v2/wiki/update/${cbrWiki.id}`;
					const data = {
							"id": cbrWiki.id,
							"title": title,
							"content": obsContent,
							"html": htmlEL.innerHTML
						};
					await this._putCbr(KeyJWT, url, data);
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

			} else {
				new Notice(`Warning! Markdown edit mode is needed!`);
			}
		} 
	}

	async _getCbrAccessToken(){
		const xBrowserId = `fr45654fgf-b622-2cc0b14369e2d3viyar`;
		const username = `apirobotwiki`;
		const password = `mvi75Yh16Re917vu`;
		const cbrUrl = `https://home.cbr.rocks`;
		// const username = `apirobot`;
		// const password = `A2p0i1r9obot`;
		// const cbrUrl = `https://demotour.davintoo.com`;
		const payload = {"email": username,"password": password,"browser_id": xBrowserId};
		const response = JSON.parse(await request({
			url: cbrUrl + `/api/rest.php/auth/session`,
			method: "POST",
			contentType: "application/json;charset=UTF-8",
			body: JSON.stringify(payload),
			headers: {
				'x-browser-id': xBrowserId,
			}
		}));
		console.log(response.jwt_token);
		return response.jwt_token || null;
	}

	async _getCbr(KeyJWT: string, urlRequest: string) {
		const xBrowserId = `fr45654fgf-b622-2cc0b14369e2d3viyar`;
		const response = JSON.parse(await request({
			url: urlRequest,
			method: "GET",
			headers: {
				'Authorization': `Bearer ${KeyJWT}`,
				'Content-Type': `application/json;charset=UTF-8`,
				'x-browser-id': xBrowserId
			},
		}));
		return response || null;
	}

	async _putCbr(KeyJWT: string, urlRequest: string, data: any) {
		const xBrowserId = `fr45654fgf-b622-2cc0b14369e2d3viyar`;
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
		return response || null;
	}

	/***
	function getRequestCbrAPI(KeyJWT, urlRequest) {
		let response = UrlFetchApp.fetch(
		  urlRequest,
		  {
			headers: {
			  'Authorization': 'Bearer ' + KeyJWT,
			  'Content-Type': 'application/json;charset=UTF-8',
			  'x-browser-id': xBrowserId
			},
			'method': 'get',
			'muteHttpExceptions': (!DEVMODE)
		  });
		let rez = {
		  '200': function response200() {
			let res = JSON.parse(response.getContentText());
			return res;
		  },
		  'default': function () {
			return 'Error ' + response.getResponseCode() + ': ' + response.getContentText();
		  }
		};
		return (rez[response.getResponseCode()] || rez['default'])();
	  }
	  
	  function postRequestCbrAPI(KeyJWT, urlRequest, payload) {
		let response = UrlFetchApp.fetch(
		  urlRequest,
		  {
			headers: {
			  'Authorization': 'Bearer ' + KeyJWT,
			  'Content-Type': 'application/json;charset=UTF-8'
			},
			'method': 'POST',
			'payload': payload,
			'muteHttpExceptions': (!DEVMODE)
		  });
		let rez = {
		  '200': function response200() {
			let res = JSON.parse(response.getContentText());
			return res;
		  },
		  'default': function () {
			return 'Error ' + response.getResponseCode() + ': ' + response.getContentText();
		  }
		};
		return (rez[response.getResponseCode()] || rez['default'])();
	  }
	  ***/

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
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
