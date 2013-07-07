/*!
 * yule JavaScript Library Beta v0.2
 * https://github.com/madisonbrown/yule
 *
 * Copyright 2013 by Madison Brown
 * Released under the MIT license
 *
 * Date: 06-20-2013
 */
 
function Yule(){};

Yule.XMLHelper = function(){};
Yule.XMLHelper.parse = function(xmlFile){
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.open("GET", xmlFile, false);
	xmlhttp.send();
	
	return xmlhttp.responseXML;
};

Yule.Frame = function(){
	this.shell = new Yule.Container();
};
Yule.Frame.prototype.inflate = function(xmlFile, document){
	this.build(Yule.XMLHelper.parse(xmlFile), document);
	
	return this;
};
Yule.Frame.prototype.build = function(xmlDoc, document){
	this.shell.id = "shell";
	this.shell.build(xmlDoc.childNodes, document);
	
	return this;
};
Yule.Frame.prototype.renderTo = function(domObject){
	function getPos(el){
		for (var lx=0, ly=0;
			 el != null;
			 lx += el.offsetLeft, ly += el.offsetTop, el = el.offsetParent);
		return {x: lx,y: ly};
	}
	
	if (domObject.innerWidth != null) 
		this.render(0, 0, parseFloat(domObject.innerWidth), parseFloat(domObject.innerHeight));
	else if (domObject.offsetWidth != null)
		this.render(0, 0, parseFloat(domObject.offsetWidth), parseFloat(domObject.offsetHeight));
};
Yule.Frame.prototype.render = function(left, top, width, height){	
	this.shell.size = new Yule.Vector().set(
		new Yule.Dim(width, "px"),
		new Yule.Dim(height, "px"));
	this.shell.offset = new Yule.Vector().set(
		new Yule.Dim(left, "px"),
		new Yule.Dim(top, "px"));
	this.shell.reset();
	this.shell.render();
};

Yule.Container = function(){
	Yule.Container.StackManager = function(stackStyle, container){
		Yule.Container.StackManager.RenderGroup = function(manager){
			this.stack = [];
			this.manager = manager;
		}
		Yule.Container.StackManager.RenderGroup.prototype.register = function(container){
			this.stack[this.stack.length] = container;
		};
		Yule.Container.StackManager.RenderGroup.prototype.aSize = function(dimension){
			var aSize = 0;
			if (this.isParallel(dimension, this.manager.stackStyle))
			{
				var spacing = this.manager.container.spacing.toAbs(this.manager.container.innerSize(dimension));
				for (var i = 0; i < this.stack.length; i++)
				{
					if (this.stack[i].size.getType(dimension) != "fill")
						aSize += this.stack[i].outerSize(dimension);
					else
					{
						if (this.stack[i].minSize != null)
							aSize += this.stack[i].minSize.toAbs(dimension, this.manager.container);
						
						aSize += this.stack[i].margin.sumToAbs(dimension, this.manager.container, true);
					}
						
					if (i < this.stack.length - 1)
						aSize += spacing;
				}
			}
			else
			{
				for (var i = 0; i < this.stack.length; i++)
				{
					var childType = this.stack[i].size.getType(dimension);
					if (this.stack[i].size.getType(dimension) != "fill")
					{
						var childSize = this.stack[i].outerSize(dimension);
						if (childSize > aSize)
							aSize = childSize;
					}
					else
					{
						var childSize = this.stack[i].margin.sumToAbs(dimension, this.manager.container, true);
						if (this.stack[i].minSize != null && !this.isParallel(dimension))
							childSize += this.stack[i].minSize.toAbs(dimension, this.manager.container);
							
						if (childSize > aSize)
							aSize = childSize;
					}
				}
			}
			
			return aSize;
		};
		Yule.Container.StackManager.RenderGroup.prototype.offsetOf = function(container, dimension){
			if (this.indexOf(container) >= 0)
			{
				var offset = 0;
				if (this.isParallel(dimension))
				{
					var spacing = container.parent.spacing.toAbs(container.parent.innerSize(dimension));
					var vertical = this.isVertical(this.manager.stackStyle);
					if (vertical && this.manager.stackStyle.style == "top" || !vertical && this.manager.stackStyle.style == "left")
					{
						var i = 0;
						while (i < this.stack.length && this.stack[i] !== container)
							offset += this.stack[i++].outerSize(dimension) + spacing;
					}
					else
					{
						var i = this.stack.length - 1;
						while (i >= 0 && this.stack[i] !== container)
							offset += this.stack[i--].outerSize(dimension) + spacing;
					}
				}
				
				return offset;
			}
			else
				return null;
		};
		Yule.Container.StackManager.RenderGroup.prototype.indexOf = function(container){
			var i = 0;
			while (i < this.stack.length && this.stack[i] !== container)
				i++;
				
			if (i < this.stack.length)
				return i;
			else
				return -1;
		};
		Yule.Container.StackManager.RenderGroup.prototype.isVertical = function(){
			var vertical = null;
			if (this.manager.stackStyle.style == "left" || this.manager.stackStyle.style == "right")
				vertical = false;
			else if (this.manager.stackStyle.style == "top" || this.manager.stackStyle.style == "bottom")
				vertical = true;
			
			return vertical;
		};
		Yule.Container.StackManager.RenderGroup.prototype.isParallel = function(dimension){
			var vertical = this.isVertical();
			if (vertical != null)
				return (!vertical && dimension == "x") || (vertical && dimension == "y");
		};
		Yule.Container.StackManager.RenderGroup.prototype.fillers = function(dimension){
			var fillers = 0
			for (var i = 0; i < this.stack.length; i++)
				if (this.stack[i].size.getType(dimension) == "fill")
					fillers++;
						
			return fillers;
		};
	
		this.stackStyle = stackStyle;
		this.container = container;
		this.stack = [];
		this.groups = [];
	}
	Yule.Container.StackManager.prototype.register = function(container){
		this.stack[this.stack.length] = container;
	};
	Yule.Container.StackManager.prototype.organize = function(){
		var _stackManager = this;
		function stackDimension(){
			if (_stackManager.isVertical())
				return "y";
			else
				return "x";
		}
		function flip(dimension){
			if (dimension == "x")
				return "y";
			else
				return "x";
		}
		function appendGroup(){
			_stackManager.groups[_stackManager.groups.length] = new Yule.Container.StackManager.RenderGroup(_stackManager);
			current = _stackManager.groups.length - 1;
			groupSize[current] = 0;
		}
		
		var dimension = stackDimension();
		var pType = this.container.size.getType(dimension);
		var spacing = this.container.spacing.toAbs(this.container.size.toAbs(dimension, this.container.parent, true)
			-this.container.padding.sumToAbs(dimension, this.container, false));
		
		this.groups = [];
		var groupSize = [];
		var current = null;
		
		for (var i = 0; i < this.stack.length; i++)
		{
			var entrySize = 0;
			if (this.stack[i].size.getType(dimension) != "fill")
				entrySize = this.stack[i].aSize(dimension);
			else if (this.stack[i].minSize != null)
				entrySize = this.stack[i].minSize.toAbs(dimension, this.container);
			
			if (pType == "px" || pType == "%" || pType == "fill")
			{
				var pInner = this.container.size.toAbs(dimension, this.container.parent, true) 
					-this.container.padding.sumToAbs(dimension, this.container, false);
					
				if (groupSize[current] + entrySize > pInner || current == null)
					appendGroup()
			}
			else if (pType == "min")
			{
				var d = flip(dimension);
				
				var xSize = 0;
				if (this.stack[i].size.getType(d) != "fill")
					xSize = this.stack[i].aSize(d);
				else if (this.stack[i].minSize != null)
					xSize = this.stack[i].minSize.toAbs(d, this.container);
				
				var pInner = this.container.size.toAbs(d, this.container.parent, true) - this.container.padding.sumToAbs(d, this.container, false);
				var thisSize = this.aSize(d) + spacing + xSize;
				if (thisSize < pInner || current == null)
					appendGroup()
				else
				{
					var next = 0;
					for (var j = 0; j < groupSize.length; j++)
						if (groupSize[j] < groupSize[next])
							next = j;
					current = next;
				}
			}
			
			this.groups[current].register(this.stack[i]);
			groupSize[current] += entrySize + spacing;
		}
	};
	Yule.Container.StackManager.prototype.aSize = function(dimension){
		var aSize = 0;
		if (this.isParallel(dimension))
			for (var i = 0; i < this.groups.length; i++)
			{
				var groupSize = this.groups[i].aSize(dimension, this.container);
				if (groupSize > aSize)
					aSize = groupSize;
			}
		else
		{
			var spacing = this.container.spacing.toAbs(this.container.innerSize(dimension));
			
			for (var i = 0; i < this.groups.length; i++)
			{
				aSize += this.groups[i].aSize(dimension, this.container);
				
				if (i < this.groups.length - 1)
					aSize += spacing;
			}
		}
		
		return aSize;
	};
	Yule.Container.StackManager.prototype.offsetOf = function(container, dimension){
		var offset = 0;
		if (this.isParallel(dimension))
		{
			var index = 0;
			while ((offset = this.groups[index].offsetOf(container, dimension, this.container)) == null && index < this.groups.length)
				index ++;
		}
		else
		{
			var spacing = this.container.spacing.toAbs(this.container.innerSize(dimension));
			
			var index = 0;
			while (this.groups[index].offsetOf(container, dimension, this.container) == null && index < this.groups.length)
			{
				offset += this.groups[index++].aSize(dimension, this.container);
			
				if (index > 0)
					offset += spacing;
			}
		}
		
		return offset;
	};
	Yule.Container.StackManager.prototype.indexOf = function(container){
		var i = 0;
		while (i < this.stack.length && this.stack[i] !== container)
			i++;
			
		return i;
	};
	Yule.Container.StackManager.prototype.groupOf = function(container){
		var i = 0;
		while (this.groups[i].indexOf(container) == -1)
			i++;
			
		return this.groups[i];
	};
	Yule.Container.StackManager.prototype.indexOfGroup = function(group){
		var i = 0;
		while (i < this.groups.length && this.groups[i] !== group)
			i++;
			
		return i;
	};
	Yule.Container.StackManager.prototype.isVertical = function(){
		var vertical = null;
		if (this.stackStyle.style == "left" || this.stackStyle.style == "right")
			vertical = false;
		else if (this.stackStyle.style == "top" || this.stackStyle.style == "bottom")
			vertical = true;
		
		return vertical;
	};
	Yule.Container.StackManager.prototype.isParallel = function(dimension){
		var vertical = this.isVertical();
		if (vertical != null)
			return (!vertical && dimension == "x") || (vertical && dimension == "y");
	};
	Yule.Container.StackManager.prototype.fillers = function(dimension){
		var fillers = 0;
		for (var i = 0; i < this.groups.length; i++)
			if (this.groups[i].fillers(dimension) > 0)
				fillers++;
				
		return fillers;
	};

	this.id = null;
	this.offset = new Yule.Vector();
	this.size = new Yule.Vector();
	this.minSize = new Yule.Vector();
	this.maxSize = null;
	this.margin = new Yule.EdgeSet();
	this.padding = new Yule.EdgeSet();
	this.spacing = new Yule.Dim();
	this.stack = new Yule.StackStyle();
	this.align = new Yule.AlignStyle();
	this.contentAlign = new Yule.AlignStyle();
	this.element = null;
	this.className = null;
	this.isRender = false;
	this.style = null;
	
	this._xml = null;
	this._relative = false;
	this._realPadded = false;
	
	this.parent = null;
	this.children = [];
	this.stackManager = new Yule.Container.StackManager(this.stack, this);
	
	this.domObject = null;
};
Yule.Container.prototype.addChild = function(container){
	if (container.parent != null)
		container.parent.removeChild(container);
	container.parent = this;
	
	if (this.stack.style != null)
		this.stackManager.register(container);
	
	this.children[this.children.length] = container;
};
Yule.Container.prototype.removeChild = function(container){
	for (var i = 0; i < this.children; i++)
		if (this.children[i] === container)
			this.children.splice(i, 1);
	
	container.parent = null;
};
Yule.Container.prototype.getChildById = function(id){
	var result = null;
	function seek(container){
		for (var i = 0; i < container.children.length; i++)
		{
			var child = container.children[i];
			
			if (child.id == id)
			{
				result = child;
				break;
			}
			else
				seek(child);
		}
	}
	
	seek(this);
	
	return result;
};
Yule.Container.prototype.getChildByXml = function(node){
	var result = null;
	function seek(container){
		for (var i = 0; i < container.children.length; i++)
		{
			var child = container.children[i];
			
			if (child._xml === node)
			{
				result = child;
				break;
			}
			else
				seek(child);
		}
	}
	
	seek(this);
	
	return result;
};
Yule.Container.prototype.aSize = function(dimension){
	if (this._sizeActive.getValue(dimension) == false) //prevent infinite loop
	{
		if (this._aSize.getValue(dimension) == null) //check to see if aSize has already been calculated this render cycle
		{
			this._sizeActive.setValue(dimension, true);
			
			var aSize = 0;
			var sizeType = this.size.getType(dimension); //Get the type of this containers specified size.
			
			if (sizeType == "px" || sizeType == "%")
			{
				var refContainer = this.parent;
				while (refContainer != null && refContainer.size.getType(dimension) == null && refContainer.parent != null)
					refContainer = refContainer.parent;
				aSize = this.size.toAbs(dimension, refContainer, true);
				
				if(sizeType == "%") //If specified size is percent, then size includes this containers margins.
					aSize -= this.margin.sumToAbs(dimension, this.parent, true);
			}
			else if (sizeType == "fill" && this.parent != null)
			{
				var stackGroup = this.parent.stackManager.groupOf(this);
				
				var fillers = stackGroup.fillers(dimension);
				if (fillers > 0) //If this container is filling a stack:
				{
					//aSize equals the free space of the parent divided by the number of fillers in the stack, adjusted for non-integer results.
					//FIX: adjust for multicolumn stack
					var freeSpace = 0;
					if (this.parent.stackManager.isParallel(dimension))
						freeSpace = this.parent.innerSize(dimension) - stackGroup.aSize(dimension);
					else
					{
						var groupSize = stackGroup.aSize(dimension);
						if (this.parent.stackManager.indexOfGroup(stackGroup) == this.parent.stackManager.groups.length - 1)
							freeSpace = this.parent.innerSize(dimension) - (this.parent.stackManager.aSize(dimension) - groupSize);
						else
							freeSpace = groupSize;
							
						fillers = 1;
					}
					
					var unrounded = freeSpace / fillers + this.minSize.toAbs(dimension, this.parent); //FIX: take into account offset, dont add minsize
					aSize = Math.floor(unrounded);
					if (unrounded - aSize != 0 && stackGroup.indexOf(this) == Math.round((stackGroup.stack.length - 1) / 2))
						aSize++;
				}
				else //Otherwise, aSize equals innerSize of the parent minus this containers margins.
					aSize = this.parent.innerSize(dimension) - this.margin.sumToAbs(dimension, this.parent, true);
			}
			else if (sizeType == "min")
			{
				aSize = this.stackManager.aSize(dimension) + this.padding.sumToAbs(dimension, this, false);
			}
			else if (sizeType == null) //If the type of this containers specified size is undefined, it should expand to fit its contents:
			{				
				if (this.isStackingBy(dimension)) //If this container is stacking:
					aSize = this.stackManager.aSize(dimension); //Get the size from the StackManager. //FIX: infinite loop possible
				else
				{
					//Otherwise, get the max size of the child containers.
					var childMax = 0;
					for (var i = 0; i < this.children.length; i++) 
					{
						var childType = this.children[i].size.getType(dimension);
						if (childType == "px" || childType == null)
						{
							var childSize = this.children[i].outerSize(dimension);
							if (childSize > childMax)
								childMax = childSize;
						}
					}
					aSize = childMax;
				}
				
				//Now check to see if the domObjects content will fit...
				function fitToContent(container){
					if (container.domObject != null) 
					{				
						//make sure the domObjects dimensions are set in the correct order
						if (!container._presizing && !container._rendering && !container._rendered) 
							container.presizeDomObject();
							
						var dSize = 0;
						if (dimension == "x")
							dSize = container.domObject.offsetWidth;
						else if (dimension == "y")
							dSize = container.domObject.offsetHeight;
						
						var refParent = container.parent;
						var marpad = 0;
						while (refParent.size.getType(dimension) == null & refParent.parent != null)
						{
							marpad += refParent.margin.sumToAbs(dimension, refParent.parent, true);
							marpad += refParent.padding.sumToAbs(dimension, this, false);
							refParent = refParent.parent;
						}
						
						var maximum = refParent.freeSpace(dimension) - marpad - container.margin.sumToAbs(dimension, container.parent, true);
						if (aSize < dSize)
						{
							if(dSize < maximum) //and dont exceed available space within the parent.
								aSize = dSize;
							else
								aSize = maximum;
						}
					}
					
					for (var i = 0; i < container.children.length; i++)
						fitToContent(container.children[i]);
				}
				fitToContent(this);
				
				//At minimum, aSize of this container will equal its padding, relative to itself (in case of %). 
				aSize += this.padding.sumToAbs(dimension, this, false);
			}
			
			if (aSize < 0)
				aSize = 0;
			if (this.minSize != null)
			{
				var minSize = this.minSize.toAbs(dimension, this.parent);
				if (aSize < minSize)
					aSize = minSize
			}
			
			this._aSize.setValue(dimension, aSize);
			this._sizeActive.setValue(dimension, false);
		}
			
		return this._aSize.getValue(dimension);
	}
	else
		return 0;
};
Yule.Container.prototype.aPosition = function(dimension){
	if (this._positionActive.getValue(dimension) == false)
	{
		if (this._aPosition.getValue(dimension) == null)
		{
			this._positionActive.setValue(dimension, true);
			
			//At minimum, aPosition will include this containers specified offset and its top-left margin.
			var aPos = this.offset.toAbs(dimension, this.parent, true) + this.margin.toAbs(dimension, false, this.parent, true);
				
			if (this.parent != null)//If this container has a parent:
			{
				//It will be further offset by its parent's aPosition...
				if (!this._relative)
					aPos += this.parent.aPosition(dimension)
				
				//as well as its parent's top-left padding.
				aPos += this.parent.padding.toAbs(dimension, false, this.parent, false);
				
				//Additionally, if this container is part of a stack, it will be offset by that stack.
				if (this.parent.isStacking())
					aPos += this.parent.stackManager.offsetOf(this, dimension);
				
				var test = this.parent.isStackingBy(dimension);
				if (!test)
				{
					//Otherwise, if this container is aligned within its parent, it will be offset accordingly.
					var alignStyle = this.align.getStyle(dimension);
					if (alignStyle == "center")
						aPos += this.parent.innerSize(dimension) / 2 - this.outerSize(dimension) / 2;
					else if ((dimension == "y" && alignStyle == "bottom") || (dimension == "x" && alignStyle == "right"))
						aPos += this.parent.innerSize(dimension) - this.outerSize(dimension);
				}
			}
			
			if (this._relative && aPos < 0)
				aPos = 0;
			
			this._aPosition.setValue(dimension, aPos);
			this._positionActive.setValue(dimension, false);
		}
			
		return this._aPosition.getValue(dimension);
	}
	else
		return 0;
};
Yule.Container.prototype.outerSize = function(dimension){
	return this.aSize(dimension) + this.margin.sumToAbs(dimension, this.parent, true);
};
Yule.Container.prototype.innerSize = function(dimension){
	return this.aSize(dimension) - this.padding.sumToAbs(dimension, this, false);
};
Yule.Container.prototype.freeSpace = function(dimension){
	if (this.stackManager.isParallel(dimension))
		return this.innerSize(dimension) - this.stackManager.aSize(dimension);
	else
		return this.innerSize(dimension);
};
Yule.Container.prototype.initialize = function(document){
	this.stackManager = new Yule.Container.StackManager(this.stack, this);
	
	if (this.element != null && this.domObject == null)
	{
		this.domObject = document.getElementById(this.element);
		if (this.domObject != null)
		{
			if (this.className != null)
				this.domObject.className = this.className;
			if (this.style != null)
				this.domObject.style.cssText = this.style;
		}
	}
		
	if (this.domObject != null) //if the element existed in the document or if it has been set manually:
	{
		this.domObject.style.position = "absolute";
		
		//If the linked domObject contains content, and that content is set to align:
		if (this.domObject.innerHTML != "")
		{
			var content = new Yule.Container();
			
			content.id = this.id + "_content";
			content.size = new Yule.Vector().set(new Yule.Dim(null, null), new Yule.Dim(null, null));
			content.align = this.contentAlign;
			content._relative = true;
			
			content.domObject = document.createElement("div");
			content.domObject.id = this.id;
			content.domObject.style.position = "relative";
			content.domObject.style.overflow = "hidden";
			//content.domObject.style.border = "solid 1px";
			if (content.align.h == "left")
				content.domObject.style.textAlign = "left";
			else if (content.align.h == "center")
				content.domObject.style.textAlign = "center";
			else if (content.align.h == "right")
				content.domObject.style.textAlign = "right";
			content.domObject.innerHTML = this.domObject.innerHTML;
			
			this.domObject.innerHTML = "";
			this.domObject.appendChild(content.domObject);
			//document.body.insertBefore(content.domObject, this.domObject.nextSibling);
			
			this.addChild(content);
		}
		else
			this._realPadded = true;
	}
	else if (this.element == null && this.isRender == "true")
	{
		this.domObject = document.createElement("div");
		this.domObject.style.zIndex = 0;
		this.domObject.id = this.id;
		this.domObject.className = this.className;
		this.domObject.style.cssText = this.style;
		this.domObject.style.position = "absolute";
		document.body.insertBefore(this.domObject, document.body.firstChild);
	}
};
Yule.Container.prototype.build = function(nodes, document){	
	for (var i = 0; i < nodes.length; i++)
	{
		if (nodes[i].tagName == "container")
		{
			var container = new Yule.Container();
			
			container.id = nodes[i].getAttribute("id");
			container.offset = Yule.Vector.parse(nodes[i].getAttribute("offset"));
			container.size = Yule.Vector.parse(nodes[i].getAttribute("size"));
			container.minSize = Yule.Vector.parse(nodes[i].getAttribute("minSize"));
			container.maxSize = Yule.Vector.parse(nodes[i].getAttribute("maxSize"));
			container.margin = Yule.EdgeSet.parse(nodes[i].getAttribute("margin"));
			container.padding = Yule.EdgeSet.parse(nodes[i].getAttribute("padding"));
			container.spacing = Yule.Dim.parse(nodes[i].getAttribute("spacing"), ["px", "%"]);
			container.stack = Yule.StackStyle.parse(nodes[i].getAttribute("stack"));
			container.align = Yule.AlignStyle.parse(nodes[i].getAttribute("align"));
			container.contentAlign = Yule.AlignStyle.parse(nodes[i].getAttribute("contentAlign"));
			container.element = nodes[i].getAttribute("element");
			container.className = nodes[i].getAttribute("class");
			container.isRender = nodes[i].getAttribute("render");
			container.style = nodes[i].getAttribute("style");
			container._xml = nodes[i];
			
			container.initialize(document);
			
			this.addChild(container.build(nodes[i].childNodes, document));
		}
	}
	
	return this;
};
Yule.Container.prototype.preRender = function(){
	for (var i = 0; i < this.children.length; i++)
		this.children[i].preRender();
	
	this.stackManager.organize();
};
Yule.Container.prototype.render = function(){
	this.preRender();
	
	this._rendering = true;
	
	if (this.domObject != null)
	{
		this.presizeDomObject();
		this.postsizeDomObject();
		this.domObject.style.left = this.aPosition("x") + "px";
		this.domObject.style.top = this.aPosition("y") + "px";
		if (this._realPadded)
			this.domObject.style.padding = this.padding.toString();
		this.domObject.style.visibility = "visible";
	}
	
	for (var i = 0; i < this.children.length; i++)
		this.children[i].render();
	
	this._rendering = false;
	this._rendered = true;
};
Yule.Container.prototype.presizeDomObject = function(){
	if (this.domObject != null)
	{
		this._presizing = true;
		if (this.size.getType("y") == null)
		{
			if (!this._sizeActive.getValue("x"))
			{
				var width = this.aSize("x");
				if (this._realPadded)
					width -= this.padding.sumToAbs("x");
				
				this.domObject.style.width = width + "px";
			}
		}
		else if (!this._sizeActive.getValue("y"))
		{
			var height = this.aSize("y");
			if (this._realPadded)
				height -= this.padding.sumToAbs("y");
			this.domObject.style.height = height + "px";
		}
		this._presizing = false;
	}
};
Yule.Container.prototype.postsizeDomObject = function(){
	if (this.domObject != null)
	{
		if (this.size.getType("y") == null)
		{
			if (!this._sizeActive.getValue("y"))
			{
				var height = this.aSize("y");
				if (this._realPadded)
					height -= this.padding.sumToAbs("y");
				this.domObject.style.height = height + "px";
			}
		}
		else if (!this._sizeActive.getValue("x"))
		{
			var width = this.aSize("x");
			if (this._realPadded)
				width -= this.padding.sumToAbs("x");
			
			this.domObject.style.width = width + "px";
		}
	}
};
Yule.Container.prototype.reset = function(){
	this._aSize = new Yule.Vector().set(new Yule.Dim(null, "px"), new Yule.Dim(null, "px"));
	this._aPosition = new Yule.Vector().set(new Yule.Dim(null, "px"), new Yule.Dim(null, "px"));
	this._sizeActive = new Yule.Vector().set(new Yule.Dim(false, "px"), new Yule.Dim(false, "px"));
	this._positionActive = new Yule.Vector().set(new Yule.Dim(false, "px"), new Yule.Dim(false, "px"));
	
	if (this.domObject != null)
	{
		this.domObject.style.visibility = "hidden";
		this.domObject.style.left = "0px";
		this.domObject.style.top = "0px";
		this.domObject.style.height = "";
		this.domObject.style.width = "";
	}
		
	for (var i = 0; i < this.children.length; i++)
		this.children[i].reset();
		
	this._rendered = false;
};
Yule.Container.prototype.isStackingBy = function(dimension){
	return (this.isStacking() && this.stackManager.isParallel(dimension));
};
Yule.Container.prototype.isStacking = function(){
	return (this.stackManager.stackStyle.style != null);
};

Yule.Dim = function(value, type){
	Yule.Dim.parse = function(data, types){
		var dim = new Yule.Dim(0, null);
		if (data != null)
		{
			var pattern = /[^0-9]/;
			var match = pattern.exec(data);
			if (match != null)
			{
				dim.value = parseFloat(data.slice(0, match.index));
				var type = data.slice(match.index);
				if (types.indexOf(type) > -1)
					dim.type = type;
			}
		}
		
		return dim;
	};
	
	this.value = value;
	this.type = type;
};
Yule.Dim.prototype.toAbs = function(reference){
	if (this.type == "px")
		return this.value;
	else if (this.type == "%")
		return Math.round(reference * this.value / 100);
	else
		return 0;
};

Yule.Vector = function(){
	Yule.Vector.parse = function(data){
		var vector = new Yule.Vector();
		if (data != null)
		{
			var values = data.split(" ");
			if (values.length == 2)
			{
				var types = ["px", "%", "fill", "min"];
				vector.x = Yule.Dim.parse(values[0], types);
				vector.y = Yule.Dim.parse(values[1], types);
			}
		}
		
		return vector;
	};
	
	this.x = new Yule.Dim(0, "px");
	this.y = new Yule.Dim(0, "px");
};
Yule.Vector.prototype.get = function(dimension){
	if (dimension == "x")
		return this.x;
	else if (dimension == "y")
		return this.y;
	else
		return null;
};
Yule.Vector.prototype.getValue = function(dimension){
	var d = this.get(dimension);
	if (d != null)
		return d.value;
	else
		return 0;
};
Yule.Vector.prototype.getType = function(dimension){
	var d = this.get(dimension);
	if (d != null)
		return d.type;
	else
		return null;
};
Yule.Vector.prototype.set = function(x, y){
	this.x = x;
	this.y = y;
	
	return this;
};
Yule.Vector.prototype.setValue = function(dimension, value){
	var d = this.get(dimension);
	if (d != null)
		d.value = value;
};
Yule.Vector.prototype.setType = function(dimension, type){
	var d = this.get(dimension);
	if (type == "px" || type == "%" || type == "fill")
	{
		if (d != null)
			d.type = type;
	}
	else
	{
		if (d != null)
			d.type = null;
	}
};
Yule.Vector.prototype.toAbs = function(dimension, refContainer, inner){
	var reference = 0;
	var type = this.getType(dimension);
	if (type == "%" && refContainer != null)
	{
		if (inner)
			reference = refContainer.innerSize(dimension);
		else
			reference = refContainer.aSize(dimension);
	}
	
	return this.get(dimension).toAbs(reference);
};

Yule.EdgeSet = function(){
	Yule.EdgeSet.parse = function(data){
		var edgeSet = new Yule.EdgeSet();
		if (data != null)
		{
			var values = data.split(" ");
			var types = ["px", "%"];
			if (values.length == 1)
			{
				edgeSet.t = edgeSet.r = edgeSet.b = edgeSet.l = Yule.Dim.parse(values[0], types);
			}
			else if (values.length == 4)
			{
				
				edgeSet.t = Yule.Dim.parse(values[0], types);
				edgeSet.r = Yule.Dim.parse(values[1], types);
				edgeSet.b = Yule.Dim.parse(values[2], types);
				edgeSet.l = Yule.Dim.parse(values[3], types);
			}
		}
		
		return edgeSet;
	};
	
	this.t = new Yule.Dim(0, "px");
	this.r = new Yule.Dim(0, "px");
	this.b = new Yule.Dim(0, "px");
	this.l = new Yule.Dim(0, "px");
};
Yule.EdgeSet.prototype.get = function(dimension, post){
	if (dimension == "x")
	{
		if (post)
			return this.r;
		else
			return this.l;
	}
	else if (dimension == "y")
	{
		if (post)
			return this.b;
		else
			return this.t;
	}
	else
		return null;
};
Yule.EdgeSet.prototype.getValue = function(dimension, post){
	var d = this.get(dimension, post);
	if (d != null)
		return d.value;
	else
		return 0;
};
Yule.EdgeSet.prototype.getType = function(dimension, post){
	var d = this.get(dimension, post);
	if (d != null)
		return d.type;
	else
		return null;
};
Yule.EdgeSet.prototype.setValue = function(dimension, post, value){
	var d = this.get(dimension, post);
	if (d != null)
		d.value = value;
};
Yule.EdgeSet.prototype.setType = function(dimension, post, type){
	var d = this.get(dimension);
	if (type == "px" || type == "%")
	{
		if (d != null)
			d.type = type;
	}
	else
	{
		if (d != null)
			d.type = null;
	}
};
Yule.EdgeSet.prototype.toAbs = function(dimension, post, refContainer, inner){
	var reference = 0;
	var type = this.getType(dimension, post);
	if (type == "%" && refContainer != null)
	{
		if (inner)
			reference = refContainer.innerSize(dimension);
		else
			reference = refContainer.aSize(dimension);
	}
	
	return this.get(dimension, post).toAbs(reference);
};
Yule.EdgeSet.prototype.sumToAbs = function(dimension, refContainer, inner){
	return this.toAbs(dimension, false, refContainer, inner) + this.toAbs(dimension, true, refContainer, inner);
};
Yule.EdgeSet.prototype.toString = function(refContainer, inner){
	var t = this.toAbs("y", false, refContainer, inner);
	var r = this.toAbs("x", true, refContainer, inner);
	var b = this.toAbs("y", true, refContainer, inner);
	var l = this.toAbs("x", false, refContainer, inner);
	
	return t + "px" + " " + r + "px" + " " + b + "px" + " " + l + "px";
};

Yule.StackStyle = function(){
	Yule.StackStyle.parse = function(data){
		var stackStyle = new Yule.StackStyle();
		if (data == "top" || data == "bottom" || data == "left" || data == "right")
			stackStyle.style = data;
		
		return stackStyle;
	};
	
	this.style = null;
};

Yule.AlignStyle = function(){
	Yule.AlignStyle.parse = function(data){
		var alignStyle = new Yule.AlignStyle();
		if (data != null)
		{
			var values = data.split(" ");
			if (values.length == 2)
			{
				if (values[0] == "left" || values[0] == "center" || values[0] == "right")
					alignStyle.h = values[0];
				if (values[1] == "top" || values[1] == "center" || values[1] == "bottom")
					alignStyle.v = values[1];
			}
		}
		
		return alignStyle;
	};
	
	this.h = null;
	this.v = null;
};
Yule.AlignStyle.prototype.getStyle = function(dimension){
	if (dimension == "x")
		return this.h;
	else if (dimension == "y")
		return this.v;
};

if(!Array.prototype.indexOf) {
    Array.prototype.indexOf = function(needle) {
        for(var i = 0; i < this.length; i++) {
            if(this[i] === needle) {
                return i;
            }
        }
        return -1;
    };
}