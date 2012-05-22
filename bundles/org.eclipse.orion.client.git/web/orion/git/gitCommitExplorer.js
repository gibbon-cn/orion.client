/*******************************************************************************
 * @license
 * Copyright (c) 2011, 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License v1.0
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html).
 *
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*global define console document Image*/

define(['i18n!git/nls/gitmessages', 'dojo', 'orion/section', 'orion/explorer', 'orion/i18nUtil', 'orion/globalCommands', 'orion/compare/diff-provider', 'orion/compare/compare-container', 'orion/breadcrumbs', 'orion/git/gitCommands'], 
		function(messages, dojo, mSection, mExplorer, i18nUtil, mGlobalCommands, mDiffProvider , mCompareContainer, mBreadcrumbs, mGitCommands) {
	var exports = {};

	exports.GitCommitExplorer = (function() {

		/**
		 * Creates a new Git commit explorer.
		 * @class Git commit explorer
		 */
		function GitCommitExplorer(registry, commandService, linkService, selection, parentId, toolbarId, selectionToolsId, actionScopeId){
			this.parentId = parentId;
			this.registry = registry;
			this.commandService = commandService;
			this.linkService = linkService;
			this.selection = selection;
			this.parentId = parentId;
			this.toolbarId = toolbarId;
			this.selectionToolsId = selectionToolsId;
			this.checkbox = false;
			this.actionScopeId = actionScopeId;
		}
		
		GitCommitExplorer.prototype.handleError = function(error) {
			var display = {};
			display.Severity = "Error";
			display.HTML = false;
			try {
				var resp = JSON.parse(error.responseText);
				display.Message = resp.DetailedMessage ? resp.DetailedMessage : resp.Message;
			} catch (Exception) {
				display.Message = error.message;
			}
			this.registry.getService("orion.page.message").setProgressResult(display);
			
			if (error.status === 404) {
				this.initTitleBar();
				this.displayCommit();
			}
		};
		
		GitCommitExplorer.prototype.changedItem = function(parent, children) {
			this.redisplay();
		};
		
		GitCommitExplorer.prototype.redisplay = function(){
			this.display(dojo.hash());
		};
		
		GitCommitExplorer.prototype.display = function(location){
			var that = this;
			var progressService = this.registry.getService("orion.page.message");

			var loadingDeferred = new dojo.Deferred();
			progressService.showWhile(loadingDeferred, messages["Loading..."]);
			this.registry.getService("orion.git.provider").getGitClone(location).then(
				function(resp){					
					if (resp.Children.length === 0) {
						loadingDeferred.callback();
						that.initTitleBar();
						that.displayCommit();
					} else if (resp.Children.length === 1 && resp.Children[0].Type === "Commit") {
						var commits = resp.Children;
						
						that.registry.getService("orion.git.provider").getGitClone(resp.CloneLocation).then(
							function(resp){
								loadingDeferred.callback();
								var repositories = resp.Children;
								
								that.initTitleBar(commits[0], repositories[0]);
				
								that.displayCommit(commits[0]);
								that.displayTags(commits[0]);
								that.displayDiffs(commits[0]);
								
								commits[0].CloneLocation = repositories[0].Location;
								
								// render commands
								mGitCommands.updateNavTools(that.registry, that, "pageActions", "selectionTools", commits[0]);
							}, function (error) {
								loadingDeferred.callback();
								dojo.hitch(that, that.handleError)(error);
							}
						);
					}	
					progressService.setProgressMessage("");
				}, function(error){
					loadingDeferred.callback();
					dojo.hitch(that, that.handleError)(error);
				}
			);
		};
		
		GitCommitExplorer.prototype.initTitleBar = function(commit, repository){
			var that = this;
			var item = {};
			var pageTitle;
			
			if (commit){
				item.Name = commit.Name;
				item.Parents = [];
				item.Parents[0] = {};
				item.Parents[0].Name = repository.Name;
				item.Parents[0].Location = repository.Location;
				item.Parents[0].ChildrenLocation = repository.Location;
				item.Parents[1] = {};
				item.Parents[1].Name = messages["Repositories"];
				pageTitle = i18nUtil.formatMessage(messages["0 on 1 - Git"], commit.Name, repository.Name);
			} else {
				item.Name = "";
				pageTitle = messages["Git"];
			}
			
			document.title = pageTitle;
			
			var location = dojo.byId("location");
			new mBreadcrumbs.BreadCrumbs({
				container: location,
				resource: item,
				makeHref:function(seg, location){
					that.makeHref(seg, location);
				}
			});		
			mGlobalCommands.setPageTarget(repository, this.registry, this.commandService);
		};
		
		GitCommitExplorer.prototype.makeHref = function(seg, location) {
			seg.href = "/git/git-repository.html#" + (location ? location : "");
		};

		GitCommitExplorer.prototype.displayCommit = function(commit){
			
			var tableNode = dojo.byId( 'table' );	
			dojo.empty( tableNode );
			
			new mSection.Section(tableNode, {
				id: "commitSection",
				title: (commit ? messages["Commit Details"] :  messages["No Commits"]),
				iconClass: "gitImageSprite git-sprite-modification",
				content: '<list id="commitNode" class="plugin-settings-list"></list>'
			});

		    var list = dojo.byId( "commitNode" );		
			
		    var extensionListItem = dojo.create( "div", { "class":"sectionTableItem" }, list );
			var horizontalBox = dojo.create( "div", null, extensionListItem );
			var detailsView = dojo.create( "div", null, horizontalBox );
			
			var commitMessages = this._splitCommitMessage(commit.Message);

			var div = dojo.create( "div", null, detailsView );
			var mainCommitMessage = dojo.create( "span", { "class":"gitMainDescription"}, div );
			this.registry.getService("orion.core.textlink").addLinks(commitMessages[0], mainCommitMessage);
			dojo.create( "div", {"style":"padding-top:15px"}, detailsView );
			
			if (commitMessages[1] !== null){
				var secondaryCommitMessage = dojo.create( "pre", null, detailsView );
				this.registry.getService("orion.core.textlink").addLinks(commitMessages[1], secondaryCommitMessage);
				dojo.create( "div", {"style":"padding-top:15px"}, detailsView );
			}
						
			dojo.create( "span", { "class":"gitSecondaryDescription", innerHTML: i18nUtil.formatMessage(messages["commit: 0"], commit.Name)}, detailsView );
			
			if (commit.Parents && commit.Parents.length > 0){
				dojo.create( "div", null, detailsView );
				
				var parentMessage = dojo.create( "span", { "class":"gitSecondaryDescription"}, detailsView );
				
				var temp = dojo.create("span");
				var link = dojo.create("a", {className: "pnavlinkonpage", href: "/git/git-commit.html#" + commit.Parents[0].Location + "?page=1&pageSize=1"}, temp);
				dojo.place(document.createTextNode(commit.Parents[0].Name), link);
				parentMessage.innerHTML = i18nUtil.formatMessage(messages["parent: 0"], temp.innerHTML);
			}
			
			dojo.create( "div", {"style":"padding-top:15px"}, detailsView );
			
			if (commit.AuthorImage) {
				var authorImage = dojo.create("span", {"class":"git-author-icon-small"}, detailsView);
				var image = new Image();
				image.src = commit.AuthorImage;
				image.name = commit.AuthorName;
				image.width = 35;
				image.height = 35;
				dojo.place(image, authorImage, "first");
			}
			
			dojo.create( "span", { "class":"gitSecondaryDescription", 
				innerHTML: i18nUtil.formatMessage(messages["authored by 0 (1) on 2"], commit.AuthorName, commit.AuthorEmail, dojo.date.locale.format(new Date(commit.Time), {formatLength: "short"}))}, detailsView );
			
			dojo.create( "div", null, detailsView );
			dojo.create( "span", { "class":"gitSecondaryDescription", 
				innerHTML: i18nUtil.formatMessage(messages["committed by 0 (1)"],  commit.CommitterName, commit.CommitterEmail)}, detailsView );
		};
		
		GitCommitExplorer.prototype._splitCommitMessage = function(commitMessage){
			var cut = false;
			var mainMessageMaxLength = 100;
			
			var commitMessage0 = commitMessage.split(/(\r?\n|$)/)[0].trim();
			if (commitMessage0.length > mainMessageMaxLength){
				var cutPoint = commitMessage0.indexOf(" ", mainMessageMaxLength - 10);
				commitMessage0 = commitMessage0.substring(0, (cutPoint !== -1 ? cutPoint : mainMessageMaxLength));
				cut = true;
			};
			
			var commitMessage1 = commitMessage.substring(commitMessage0.length + 1, commitMessage.length).trim();
			if (commitMessage1.length > 0){
				commitMessage1 = (cut ? "..." + commitMessage1 : commitMessage1);
			} else {
				commitMessage1 = null;
			}
			
			commitMessage0 += (cut ? "..." : "");
			
			return [commitMessage0, commitMessage1];
		};
		
		// Git diffs
		
		GitCommitExplorer.prototype.displayDiffs = function(commit){
			var diffs = commit.Diffs;
			
			var tableNode = dojo.byId( 'table' );
			
			var titleWrapper = new mSection.Section(tableNode, {
				id: "diffSection",
				title: messages["Diffs"],
				content: '<list id="diffNode" class="plugin-settings-list"></list>'
			}); 
			
			if(diffs.length > 0){
				this.renderDiff(diffs, 0, titleWrapper);
			}
		};

		GitCommitExplorer.prototype.renderDiff = function(diffs, index, titleWrapper){
			
			// add diff details
			var progress = titleWrapper.createProgressMonitor();
			progress.begin("Rendering diff");
			var diff = diffs[index];
			var diffDetailsItem = dojo.create( "div", { "class":"sectionTableItem" }, dojo.byId("diffNode") );
			var diffDetailsHorizontalBox = dojo.create( "div", null, diffDetailsItem );

			var detailsView = dojo.create( "div", {"style":"float:left"}, diffDetailsHorizontalBox );
			var diffPath = diff.OldPath;
			if (diff.ChangeType === "ADD"){
				diffPath = diff.NewPath;
			}	
			progress.worked(i18nUtil.formatMessage("Rendering #{0}", diffPath));
			
			dojo.create( "span", { "class":"gitMainDescription", innerHTML: diffPath + " (" + diff.ChangeType + ") " }, detailsView );

			var compareActionsArea = dojo.create( "div", {"id":"compareActionsArea_" + index, "class":"sectionTableItemActions"}, diffDetailsHorizontalBox, "last" );
			var actionsArea = dojo.create( "div", {"id":"diffActionsArea_" + index, "class":"sectionTableItemActions"}, diffDetailsHorizontalBox,"last" );
			this.commandService.renderCommands(this.actionScopeId, actionsArea, diff, this, "tool", false);	
			
			// add inline compare view
			
			var diffItem = dojo.create( "div", { "class":"sectionTableItem" }, dojo.byId("diffNode") );
			var diffHorizontalBox = dojo.create( "div", null, diffItem );
			
			dojo.create( "div", { "id":"diffArea_" + index, "style":"height:420px;border:1px solid lightgray;overflow: hidden"}, diffHorizontalBox);

			var diffProvider = new mCompareContainer.DefaultDiffProvider(this.registry);
			
			var diffOptions = {
				commandSpanId: compareActionsArea.id,
				diffProvider: diffProvider,
				hasConflicts: false,
				readonly: true,
				complexURL: diff.DiffLocation,
				callback : function(){progress.done();}
			};
			
			var inlineCompareContainer = new mCompareContainer.toggleableCompareContainer(this.registry, "diffArea_" + index, "inline", diffOptions);
			var that = this;
			inlineCompareContainer.startup( function(maxHeight){
				var vH = 420;
				if(maxHeight < vH){
					vH = maxHeight;
				}
				dojo.style("diffArea_" + index, "height", vH + "px");
				if(index < (diffs.length -1 )){
					that.renderDiff(diffs, index+1, titleWrapper);
				}
			});
		};
		
		// Git tags

		GitCommitExplorer.prototype.displayTags = function(commit){
			var tags = commit.Tags;
			
			var tableNode = dojo.byId( 'table' );

			var titleWrapper = new mSection.Section(tableNode, {
				id: "tagSection",
				title: ((tags && tags.length > 0) ? messages["Tags:"] : messages["No Tags"]),
				iconClass: "gitImageSprite git-sprite-tag",
				slideout: true,
				content: '<list id="tagNode" class="plugin-settings-list"></list>'
			}); 
			
			this.commandService.registerCommandContribution(titleWrapper.actionsNode.id, "eclipse.orion.git.addTag", 100);
			this.commandService.renderCommands(titleWrapper.actionsNode.id, titleWrapper.actionsNode, commit, this, "button");
			
			if (!tags && tags.length > 0)
				return;
			
			for(var i=0; (i<tags.length && i<10);i++){
				this.renderTag(tags[i]);
			}
		};

		GitCommitExplorer.prototype.renderTag = function(tag){
			var extensionListItem = dojo.create( "div", { "class":"sectionTableItem" }, dojo.byId("tagNode") );
			var horizontalBox = dojo.create( "div", null, extensionListItem );

			var detailsView = dojo.create( "div", {"class":"stretch"}, horizontalBox );
			var title = dojo.create( "span", { "class":"gitMainDescription", innerHTML: tag.Name }, detailsView );

			dojo.create( "div", null, horizontalBox );

			var actionsArea = dojo.create( "div", {"id":"tagActionsArea", "class":"sectionTableItemActions"}, horizontalBox );
			this.commandService.renderCommands(this.actionScopeId, actionsArea, tag, this, "tool", false);	
		};

		return GitCommitExplorer;
	}());
	
	return exports;
}); // end of define
