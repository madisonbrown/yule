/*
 * yule JavaScript Library Beta v0.3
 * https://github.com/madisonbrown/yule
 *
 * Copyright 2013 by Madison Brown
 * Released under the MIT license
 *
 * Date: 07-28-2013
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
	this.scope = null;
};
Yule.Frame.prototype.inflate = function(xmlFile, document, scope){
	this.build(Yule.XMLHelper.parse(xmlFile), document, scope);
	
	return this;
};
Yule.Frame.prototype.build = function(xmlDoc, document, scope){
	this.scope = scope;
	var referenceNode = document.createElement("div");
	scope.insertBefore(referenceNode, scope.firstChild);
	
	this.shell.id = "shell";
	this.shell.build(xmlDoc.childNodes, document, referenceNode);
	
	scope.removeChild(referenceNode);
	
	return this;
};
Yule.Frame.prototype.renderToScope = function(){
	this.render(0, 0, parseFloat(this.scope.offsetWidth), parseFloat(this.scope.offsetHeight));
};
Yule.Frame.prototype.render = function(left, top, width, height){	
	this.shell.size = new Yule.Vector().set(
		new Yule.Dim(width, Yule.DataTypes.Px),
		new Yule.Dim(height, Yule.DataTypes.Px));
	this.shell.offset = new Yule.Vector().set(
		new Yule.Dim(left, Yule.DataTypes.Px),
		new Yule.Dim(top, Yule.DataTypes.Px));
	this.shell.reset();
	this.shell.preRender();
	this.shell.sizeElements();
	this.shell.positionElements();
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
		Yule.Container.StackManager.RenderGroup.prototype.size = function(dimension, excludeFills){
			var parallel = this.manager.isParallel(dimension);
			
			var size = 0;
			for (var i = 0; i < this.stack.length; i++)
			{
				var entry = this.stack[i];
				var entryType = entry.size.getType(dimension);
				var entrySize = 0;
				if (!excludeFills || entryType != Yule.DataTypes.Fill)
					entrySize += entry.outerSize(dimension, this.manager.isCaching());
				else if (!parallel)
					entrySize = entry.aVector(entry.minSize, dimension, this.manager.isCaching());
				
				if (parallel)
					size += entrySize;
				else if (entrySize > size)
					size = entrySize;
			}
			
			if (parallel)
				size += (this.stack.length - 1) * this.manager.spacing(dimension);
			
			return size;
		};
		Yule.Container.StackManager.RenderGroup.prototype.freeSpacePerFill = function(dimension){
			if (this.manager.isParallel(dimension))
			{
				var freeSpace = this.manager.maxSize(dimension) - this.size(dimension, true);
				var evenGroupSize = freeSpace / this.fillCount(dimension);
				var fillCount = this.fillCount(dimension);
				
				var overflow = 0;
				for (var i = 0; i < this.stack.length; i++)
				{
					var entry = this.stack[i];
					var entryType = entry.size.getType(dimension);
					if (entryType == Yule.DataTypes.Fill)
					{
						var minSize = entry.aVector(entry.minSize, dimension, this.manager.isCaching());
						if (minSize > evenGroupSize)
						{
							overflow += minSize - evenGroupSize;
							fillCount--; 
						}
					}
				}
				
				return evenGroupSize - (overflow / fillCount);
			}
			else
				return this.size(dimension, true);
		};
		Yule.Container.StackManager.RenderGroup.prototype.offsetOf = function(container, dimension){
			var offset = 0;
			var index = this.indexOf(container);
			if (index >= 0)
			{
				for (var i = 0; i < index; i++)
					offset += this.stack[i].outerSize(dimension, this.manager.isCaching());
					
				offset += this.manager.spacing(dimension) * index;
			}
			
			return offset;
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
		Yule.Container.StackManager.RenderGroup.prototype.fillCount = function(dimension){
			var fillCount = 0
			for (var i = 0; i < this.stack.length; i++)
				if (this.stack[i].size.getType(dimension) == Yule.DataTypes.Fill)
					fillCount++;
			
			return fillCount;
		};
	
		this.container = container;
		this.stackStyle = stackStyle;
		this.stack = [];
		this.groups = [];
		
		this._organizing = false;
		this._organized = false;
	}
	Yule.Container.StackManager.prototype.register = function(container){
		if (this.stackStyle != null)
			this.stack[this.stack.length] = container;
	};
	Yule.Container.StackManager.prototype.organize = function(){
		var _stackManager = this;
		function appendGroup(){
			curGroup = _stackManager.groups.length;
			_stackManager.groups[curGroup] = new Yule.Container.StackManager.RenderGroup(_stackManager);
			groupSize[curGroup] = 0;
		}
		
		this._organizing = true;
		if (this.stack.length > 0)
		{
			this.groups = [];
			var maxGroups = this.container.stackGroups;
			var maxEntries = this.container.childrenPerGroup;
			var dimension = this.stackDimension();
			var xDimension = this.perpDimension();
			var pType = this.container.size.getType(dimension);
			var spacing = this.spacing(dimension);
			var xSpacing = this.spacing(xDimension);
			var maxSize = this.maxSize(dimension);
			var maxXSize = this.maxSize(xDimension);
			
			var curGroup = null;
			var groupSize = [];
			var groupSpace = [];
			var xSize = 0;
			for (var i = 0; i < this.stack.length; i++)
			{
				var entry = this.stack[i];
				var entrySize = entry.aMargin(dimension, true, true, false);//c
				
				var entryType = entry.size.getType(dimension);
				var xEntryType = entry.size.getType(xDimension);
				
				var willSizeFill = entryType == Yule.DataTypes.Fill || (dimension == Yule.Dimensions.Y && entryType == Yule.DataTypes.Exp && xEntryType == Yule.DataTypes.Fill);
				if (!willSizeFill)
					entrySize += entry.aSize(dimension, false);//c
				else
					entrySize += entry.aVector(entry.minSize, dimension, false);//c
				
				if (pType != Yule.DataTypes.Min && maxGroups == null)
				{
					var groupHasSpace = (groupSize[curGroup] + spacing + entrySize) < maxSize;				
					if (curGroup == null || (maxEntries == null && !groupHasSpace) || 
						(maxEntries != null && this.groups[curGroup].stack.length >= maxEntries))
						appendGroup();
				}
				else
				{
					var nextSize = 0;
					if (xEntryType != Yule.DataTypes.Fill)
						nextSize = entry.outerSize(xDimension, false);//c
					else
						nextSize = entry.aVector(entry.minSize, xDimension, false);//c
					
					var pendingSize = xSize + spacing + nextSize;
					if (curGroup == null || (maxGroups != null && this.groups.length < maxGroups) || (maxGroups == null && pendingSize <= maxXSize))
					{
						appendGroup()
						groupSpace[curGroup] = nextSize;
						xSize = pendingSize;
					}
					else
					{
						var next = 0;
						while (nextSize > groupSpace[next])
							next++;
						
						if (next < this.groups.length - 1)
						{
							for (var j = 0; j < groupSize.length; j++)
								if (groupSize[j] < groupSize[next] && nextSize <= groupSpace[j])
									next = j;
							curGroup = next;
						}
						else
						{
							appendGroup()
							groupSpace[curGroup] = nextSize;
							xSize = pendingSize;
						}
					}
				}
					
				if(curGroup >= 0)
				{
					this.groups[curGroup].register(this.stack[i]);
					groupSize[curGroup] += entrySize + spacing;
				}
			}
		}
		this._organizing = false;
		this._organized = true;
	};
	Yule.Container.StackManager.prototype.aSize = function(dimension){
		var parallel = this.isParallel(dimension);
		var aSize = 0;
		for (var i = 0; i < this.groups.length; i++)
		{
			var groupSize = this.groups[i].size(dimension, false);
			
			if (!parallel)
				aSize += groupSize
			else if (groupSize > aSize)
				aSize = groupSize;
		}
		
		if (!parallel)
			aSize += (this.groups.length - 1) * this.spacing(dimension);
		
		return aSize;
	};
	Yule.Container.StackManager.prototype.freeSpaceFor = function(container, dimension){
		var freeSpace = 0;
		
		var group = this.groupOf(container);
		if (group != null)
		{
			var maxSize = this.maxSize(dimension);
			var minSize = container.aVector(container.minSize, dimension, this.isCaching());
			
			if (this.isParallel(dimension))
			{
				var freeSpace = group.freeSpacePerFill(dimension);
			}
			else
			{
				if (maxSize != null)
				{
					var thisIndex = this.indexOfGroup(group);
					var thisGroupSize = group.size(dimension, true);
					var fillGroups = this.fillGroups();
					var evenGroupSize = maxSize / fillGroups;
					
					if (thisGroupSize > evenGroupSize)
					{
						if (thisGroupSize < maxSize)
							freeSpace = thisGroupSize;
						else
							freeSpace = maxSize;
					}
					else
					{
						freeSpace = maxSize;
						for (var i = 0; i < this.groups.length; i++)
						{
							if (i != thisIndex)
							{
								var groupSize = this.groups[i].size(dimension, true);
								var groupFills = this.groups[i].fillCount(dimension);
								if ((groupFills > 0 && groupSize > evenGroupSize) || (groupFills == 0))
								{
									freeSpace -= groupSize;	
									
									if (groupFills > 0)
										fillGroups--;
								}
							}
						}
						freeSpace -= (this.groups.length - 1) * this.spacing(dimension);
						
						if (fillGroups > 0)
							freeSpace /= fillGroups;
					}
				}
			}
		}
		
		return freeSpace;
	};
	Yule.Container.StackManager.prototype.offsetOf = function(container, dimension){
		var offset = 0;
		if (this.groups.length > 0)
		{
			var group = this.groupOf(container);
			if (group != null)
			{
				if (this.isParallel(dimension))
					offset = group.offsetOf(container, dimension);
				else
				{
					var spacing = this.spacing(dimension);
					
					var index = this.indexOfGroup(group);
					for (var i = 0; i < index; i++)
						offset += this.groups[i].size(dimension, false) + spacing;
				}
			}
		}
		
		return offset;
	};
	Yule.Container.StackManager.prototype.indexOf = function(container){
		var i = 0;
		while (i < this.stack.length && this.stack[i] !== container)
			i++;
		
		if (i < this.stack.length)
			return i;
		else
			return -1;
	};
	Yule.Container.StackManager.prototype.groupOf = function(container){
		var i = 0;
		while (i < this.groups.length && this.groups[i].indexOf(container) == -1)
			i++;
		
		if (i < this.groups.length)
			return this.groups[i];
		else
			return null;
	};
	Yule.Container.StackManager.prototype.indexOfGroup = function(group){
		var i = 0;
		while (i < this.groups.length && this.groups[i] !== group)
			i++;
		
		if (i < this.groups.length)
			return i;
		else
			return -1;
	};
	Yule.Container.StackManager.prototype.stackDimension = function(){
		if (this.stackStyle != null)
		{
			if (this.stackStyle.style == "left" || this.stackStyle.style == "right")
				return Yule.Dimensions.X;
			else if (this.stackStyle.style == "top" || this.stackStyle.style == "bottom")
				return Yule.Dimensions.Y;
		}
		else
			return null;
	};
	Yule.Container.StackManager.prototype.perpDimension = function(){
		var stackDimension = this.stackDimension();
		if (stackDimension == Yule.Dimensions.X)
			return Yule.Dimensions.Y;
		else
			return Yule.Dimensions.X;
	};
	Yule.Container.StackManager.prototype.spacing = function(dimension){
		return this.container.aVector(this.container.spacing, dimension, this.isCaching());
	};
	Yule.Container.StackManager.prototype.maxSize = function(dimension){
		var maxSize = null;
		if (this.container.size.getType(dimension) != Yule.DataTypes.Exp)
			maxSize = this.container.innerSize(dimension, false);
			
		return maxSize;
	};
	Yule.Container.StackManager.prototype.fillGroups = function(){
		var dimension = this.perpDimension();
		var fillGroups = 0;
		for (var i = 0; i < this.groups.length; i++)
			if (this.groups[i].fillCount(dimension) > 0)
				fillGroups++;
		
		return fillGroups;
	};
	Yule.Container.StackManager.prototype.isVertical = function(){
		if (this.stackStyle != null)
			return this.stackDimension() == Yule.Dimensions.Y;
		else
			return null;
	};
	Yule.Container.StackManager.prototype.isParallel = function(dimension){
		if (this.stackStyle != null)
			return dimension == this.stackDimension();
		else
			return null;
	};
	Yule.Container.StackManager.prototype.isCaching = function(){
		if (!this._organizing)
			return true;
		else
			return false;
	};

	this.id = null;
	this.offset = new Yule.Vector();
	this.size = new Yule.Vector();
	this.minSize = new Yule.Vector();
	this.maxSize = null;
	this.margin = new Yule.EdgeSet();
	this.padding = new Yule.EdgeSet();
	this.spacing = new Yule.Vector();
	this.stack = new Yule.StackStyle();
	this.stackGroups = null;
	this.childrenPerGroup = null;
	this.align = new Yule.AlignStyle();
	this.contentAlign = new Yule.AlignStyle();
	this.element = null;
	this.className = null;
	this.isRender = false;
	this.style = null;
	this.cache = true;
	
	this.parent = null;
	this.children = [];
	this.stackManager = new Yule.Container.StackManager(this.stack, this);
	
	this.domObject = null;
	
	this._xml = null;
	this._relative = false;
};
Yule.Container.prototype.addChild = function(container){
	if (container.parent != null)
		container.parent.removeChild(container);
	container.parent = this;
	
	this.children[this.children.length] = container;
	
	if (this.isStacking())
		this.stackManager.register(container);
};
Yule.Container.prototype.removeChild = function(container){
	for (var i = 0; i < this.children; i++)
		if (this.children[i] === container)
			this.children.splice(i, 1);
			
	//FIX: remove from stack manager;
	
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
Yule.Container.prototype.aRef = function(dimension, cache){
	if (this.parent != null)
	{
		var ref = this;
		do
		{
			ref = ref.parent;
			var refType = ref.size.getType(dimension);
		} while((refType == Yule.DataTypes.Exp || refType == Yule.DataTypes.Min) && ref.parent != null);
		
		return ref.innerSize(dimension, cache);
	}
	else
		return 0;
};
Yule.Container.prototype.aVector = function(vector, dimension, cache){
	var refDim = dimension;
	var type = vector.getType(dimension);
	if (type == Yule.DataTypes.PctH || type == Yule.DataTypes.PctW)
	{
		var refDim = Yule.Dimensions.X;
		if (type == Yule.DataTypes.PctH)
			refDim = Yule.Dimensions.Y;
	}

	return vector.toAbs(dimension, this.aRef(refDim, cache));
};
Yule.Container.prototype.aEdge = function(edgeSet, dimension, post, cache){
	var refDim = dimension;
	var type = edgeSet.getType(dimension, post);
	if (type == Yule.DataTypes.PctH || type == Yule.DataTypes.PctW)
	{
		var refDim = Yule.Dimensions.X;
		if (type == Yule.DataTypes.PctH)
			refDim = Yule.Dimensions.Y;
	}
	
	return edgeSet.toAbs(dimension, post, this.aRef(refDim, cache));
};
Yule.Container.prototype.aEdgeSum = function(edgeSet, dimension, tl, br, cache){
	var edge = 0;
	if (tl)
		edge += this.aEdge(edgeSet, dimension, false, cache);
	if (br)
		edge += this.aEdge(edgeSet, dimension, true, cache);
	
	return edge;
};
Yule.Container.prototype.aMargin = function(dimension, tl, br, cache){
	return this.aEdgeSum(this.margin, dimension, tl, br, cache);
};
Yule.Container.prototype.aPadding = function(dimension, tl, br, cache){
	return this.aEdgeSum(this.padding, dimension, tl, br, cache);
};
Yule.Container.prototype.aSize = function(dimension, cache){
	if (this._sizeActive.getValue(dimension) == false) //prevent infinite loop
	{
		var aSize = 0;
		if (this._aSize.getValue(dimension) == null) //check to see if aSize has already been calculated this render cycle
		{
			this._sizeActive.setValue(dimension, true);
			
			var type = this.size.getType(dimension);
			if (type == Yule.DataTypes.Px)
			{
				aSize = this.size.toAbs(dimension, 0);
			}
			else if (type == Yule.DataTypes.PctH || type == Yule.DataTypes.PctW)
			{
				if (this.parent != null)
					aSize = this.aVector(this.size, dimension, cache) - this.aMargin(dimension, true, true, cache);
			}
			else if (type == Yule.DataTypes.Fill)
			{
				if (this.parent != null)
				{
					if (this.parent.isStacking())
						aSize = this.parent.stackManager.freeSpaceFor(this, dimension);
					else
						aSize = this.parent.innerSize(dimension, cache);
					
					aSize -= this.aMargin(dimension, true, true, cache);
				}
			}
			else
			{
				var padding = this.aPadding(dimension, true, true, cache);
				
				if (this.isStacking())
					aSize += this.stackManager.aSize(dimension);
				
				if (type == Yule.DataTypes.Min)
				{
					//fix
				}
				if (type == Yule.DataTypes.Exp)
				{
					for (var i = 0; i < this.children.length; i++) //Fit to children
					{
						var cType = this.children[i].size.getType(dimension);
						if (cType != Yule.DataTypes.Fill)
						{
							var cSize = this.children[i].outerSize(dimension, cache) + this.children[i].aVector(this.children[i].offset, dimension);
							if (cSize > aSize)
								aSize = cSize;
						}
					}
					
					if (this.domObject != null) //Fit to DOM Object
					{
						if (!this._sizing) 
							this.presizeDomObject();
						
						var dSize = 0;
						if (dimension == Yule.Dimensions.X)
						{
							//var pType = this.parent.size.getType(dimension);
							//if (this.parent != null && pType == Yule.DataTypes.Exp || pType == Yule.DataTypes.Min) //FIX: necessary?
								this.domObject.style.whiteSpace = "nowrap";
							
							dSize = this.domObject.offsetWidth;
							
							this.domObject.style.whiteSpace = "normal";
						}
						else if (dimension == Yule.Dimensions.Y)
							dSize = this.domObject.offsetHeight;
						
						dSize -= padding;
						
						if (aSize < dSize)
							aSize = dSize;
					}
				}
				
				aSize += padding;
			}
			
			
			var minSize = this.aVector(this.minSize, dimension, cache);
			if (aSize < minSize)
				aSize = minSize;
			
			if (aSize < 0)
				aSize == 0;
			
			if (cache && this.cache)
				this._aSize.setValue(dimension, aSize);
			this._sizeActive.setValue(dimension, false);
		}
		else
			aSize = this._aSize.getValue(dimension);
			
		return aSize;
	}
	else
		return 0;
};
Yule.Container.prototype.aPosition = function(dimension){
	if (this._positionActive.getValue(dimension) == false)
	{
		var aPos = 0;
		if (this._aPosition.getValue(dimension) == null)
		{
			this._positionActive.setValue(dimension, true);
			
			//At minimum, aPosition will include this containers specified offset and its top-left margin.
			aPos = this.aVector(this.offset, dimension, false) + this.aMargin(dimension, true, false, false);
			
			if (this.parent != null)//If this container has a parent:
			{
				//It will be further offset by its parent's aPosition...
				if (!this._relative)
					aPos += this.parent.aPosition(dimension);
				
				//as well as its parent's top-left padding.
				aPos += this.parent.aPadding(dimension, true, false, false);
				
				//Additionally, if this container is part of a stack, it will be offset by that stack.
				if (this.parent.isStacking())
					aPos += this.parent.stackManager.offsetOf(this, dimension);
				
				if (!this.parent.isStackingBy(dimension)) //If it's not stacking in the current dimension, it can also be aligned
				{
					var alignStyle = this.align.getStyle(dimension);
					
					var center = alignStyle == "center";
					var bottom = dimension == Yule.Dimensions.Y && alignStyle == "bottom";
					var right = dimension == Yule.Dimensions.X && alignStyle == "right";
					
					if (center || bottom || right)
					{
						var pSize = 0;
						if (this.parent.isStacking())
							pSize = this.parent.stackManager.groupOf(this).size(dimension, false);
						else
							pSize = this.parent.innerSize(dimension, false);
						
						var alignOffset = pSize - this.outerSize(dimension, false);
						if (center)
							alignOffset /= 2;
						
						aPos += alignOffset;
					}
				}
			}
			
			this._aPosition.setValue(dimension, aPos);
			this._positionActive.setValue(dimension, false);
		}
		else
			aPos = this._aPosition.getValue(dimension);
			
		return aPos;
	}
	else
		return 0;
};
Yule.Container.prototype.outerSize = function(dimension, cache){
	return this.aSize(dimension, cache) + this.aMargin(dimension, true, true, cache);
};
Yule.Container.prototype.innerSize = function(dimension, cache){
	return this.aSize(dimension, cache) - this.aPadding(dimension, true, true, cache);
};
Yule.Container.prototype.initialize = function(document, referenceNode){
	this.stackManager = new Yule.Container.StackManager(this.stack, this);
	
	if (this.element != null)
		this.domObject = document.getElementById(this.element);
	else if (this.isRender)
	{
		this.domObject = document.createElement("div");
		referenceNode.parentNode.insertBefore(this.domObject, referenceNode);
	}
	
	if (this.domObject != null)
	{
		if (this.className != null)
			this.domObject.className = this.className;
		if (this.style != null)
			this.domObject.style.cssText = this.style;
		this.domObject.style.position = "absolute";
			
		if (this.domObject.innerHTML != "" && (this.contentAlign.h != null || this.contentAlign.v != null))
		{
			var content = new Yule.Container();
			
			content.id = this.id + "_content";
			content.size = new Yule.Vector().set(new Yule.Dim(0, null), new Yule.Dim(0, null));
			content.align = this.contentAlign;
			content._relative = true;
			
			content.domObject = document.createElement("div");
			content.domObject.id = content.id;
			content.domObject.style.position = "absolute";
			if (content.align.h == "center")
				content.domObject.style.textAlign = "center";
			else if (content.align.h == "right")
				content.domObject.style.textAlign = "right";
			content.domObject.innerHTML = this.domObject.innerHTML;
			
			this.domObject.innerHTML = "";
			this.domObject.appendChild(content.domObject);
			
			this.addChild(content);
		}
	}
};
Yule.Container.prototype.build = function(nodes, document, referenceNode){	
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
			container.spacing = Yule.Vector.parse(nodes[i].getAttribute("spacing"));
			container.stack = Yule.StackStyle.parse(nodes[i].getAttribute("stack"));
			container.stackGroups = nodes[i].getAttribute("stackGroups");
			container.childrenPerGroup = nodes[i].getAttribute("childrenPerGroup");
			container.align = Yule.AlignStyle.parse(nodes[i].getAttribute("align"));
			container.contentAlign = Yule.AlignStyle.parse(nodes[i].getAttribute("contentAlign"));
			container.element = nodes[i].getAttribute("element");
			container.className = nodes[i].getAttribute("class");
			container.style = nodes[i].getAttribute("style");
			container.isRender = nodes[i].getAttribute("render") == "true";
			container.cache = nodes[i].getAttribute("cache") == "true" || nodes[i].getAttribute("cache") == null;
			
			container._xml = nodes[i];
			
			container.initialize(document, referenceNode);
			container.build(nodes[i].childNodes, document, referenceNode)
			
			this.addChild(container);
		}
	}
};
Yule.Container.prototype.preRender = function(){
	for (var i = 0; i < this.children.length; i++)
		this.children[i].preRender();
	
	this.stackManager.organize();
};
Yule.Container.prototype.sizeElements = function(){
	this._sizing = true;
	
	if (this.domObject != null)
	{
		this.presizeDomObject();
		this.postsizeDomObject();
	}
	
	for (var i = 0; i < this.children.length; i++)
		this.children[i].sizeElements();
	
	this._sizing = false;
};
Yule.Container.prototype.presizeDomObject = function(){
	if (this.domObject != null)
	{
		this._sizing = true;
		this._presizing = true;
		
		if (this.size.getType(Yule.Dimensions.Y) == Yule.DataTypes.Exp)
		{
			if (!this._sizeActive.getValue(Yule.Dimensions.X))
				this.domObject.style.width = this.aSize(Yule.Dimensions.X, true) + Yule.DataTypes.Px;
		}
		else if (!this._sizeActive.getValue(Yule.Dimensions.Y))
			this.domObject.style.height = this.aSize(Yule.Dimensions.Y, true) + Yule.DataTypes.Px;
		
		this._presizing = false;
	}
};
Yule.Container.prototype.postsizeDomObject = function(){	
	if (this.domObject != null)
	{
		if (this.size.getType(Yule.Dimensions.Y) == Yule.DataTypes.Exp)
		{
			if (!this._sizeActive.getValue(Yule.Dimensions.Y))
				this.domObject.style.height = this.aSize(Yule.Dimensions.Y, true) + Yule.DataTypes.Px;
		}
		else if (!this._sizeActive.getValue(Yule.Dimensions.X))
			this.domObject.style.width = this.aSize(Yule.Dimensions.X, true) + Yule.DataTypes.Px;
			
		this._sizing = false;
	}
};
Yule.Container.prototype.positionElements = function(){
	this._positioning = true;
	
	if (this.domObject != null)
	{
		this.domObject.style.left = this.aPosition(Yule.Dimensions.X) + Yule.DataTypes.Px;
		this.domObject.style.top = this.aPosition(Yule.Dimensions.Y) + Yule.DataTypes.Px;
	}
	
	for (var i = 0; i < this.children.length; i++)
		this.children[i].positionElements();
	
	this._positioning = false;
};
Yule.Container.prototype.reset = function(){
	this._aSize = new Yule.Vector().set(new Yule.Dim(null, Yule.DataTypes.Px), new Yule.Dim(null, Yule.DataTypes.Px));
	this._aPosition = new Yule.Vector().set(new Yule.Dim(null, Yule.DataTypes.Px), new Yule.Dim(null, Yule.DataTypes.Px));
	this._sizeActive = new Yule.Vector().set(new Yule.Dim(false, null), new Yule.Dim(false, null));
	this._positionActive = new Yule.Vector().set(new Yule.Dim(false, null), new Yule.Dim(false, null));
	this.stackManager._organized = false;
	
	if (this.domObject != null)
	{
		this.domObject.style.left = "0px";
		this.domObject.style.top = "0px";
		this.domObject.style.height = "";
		this.domObject.style.width = "";
	}
		
	for (var i = 0; i < this.children.length; i++)
		this.children[i].reset();
};
Yule.Container.prototype.isStackingBy = function(dimension){
	return (this.isStacking() && this.stackManager.isParallel(dimension));
};
Yule.Container.prototype.isStacking = function(){
	return (this.stackManager.stackStyle.style != null);
};

Yule.DataTypes = function(){};
Yule.DataTypes.Px = "px";
Yule.DataTypes.PctH = "%h";
Yule.DataTypes.PctW = "%w";
Yule.DataTypes.Fill = "fill";
Yule.DataTypes.Min = "min";
Yule.DataTypes.Null = null;

Yule.Dimensions = function(){
	Yule.Dimensions.Flip = function(dimension){
	if (dimension == Yule.Vector.Dimensions.X)
		return Yule.Vector.Dimensions.Y;
	else if (dimension == Yule.Vector.Dimensions.Y)
		return Yule.Vector.Dimensions.X;
};
};
Yule.Dimensions.X = "x";
Yule.Dimensions.Y = "y";

Yule.Dim = function(value, type){
	Yule.Dim.parse = function(data, types){
		var dim = new Yule.Dim(0, null);
		if (data != null)
		{
			var pattern = /[^0-9|-]/;
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
Yule.Dim.prototype.clone = function(){
	return new Yule.Dim(this.value, this.type);
};
Yule.Dim.prototype.toAbs = function(reference){
	if (this.type == Yule.DataTypes.Px)
		return this.value;
	else if (this.type == Yule.DataTypes.PctW || this.type == Yule.DataTypes.PctH)
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
			var types = [Yule.DataTypes.Px, "%", Yule.DataTypes.PctW, Yule.DataTypes.PctH, Yule.DataTypes.Fill, Yule.DataTypes.Min];
			if (values.length == 1)
			{
				vector.x = Yule.Dim.parse(values[0], types);
				vector.y = vector.x.clone();
			}
			else if (values.length == 2)
			{
				vector.x = Yule.Dim.parse(values[0], types);
				vector.y = Yule.Dim.parse(values[1], types);
			}
			if (vector.x.type == "%")
				vector.x.type = Yule.DataTypes.PctW;
			if (vector.y.type == "%")
				vector.y.type = Yule.DataTypes.PctH;
		}
		
		return vector;
	};
	
	this.x = new Yule.Dim(0, Yule.DataTypes.Px);
	this.y = new Yule.Dim(0, Yule.DataTypes.Px);
};
Yule.Vector.prototype.get = function(dimension){
	if (dimension == Yule.Dimensions.X)
		return this.x;
	else if (dimension == Yule.Dimensions.Y)
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
	if (type == Yule.DataTypes.Px || type == "%" || type == Yule.DataTypes.Fill)
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
Yule.Vector.prototype.toAbs = function(dimension, reference){	
	return this.get(dimension).toAbs(reference);
};

Yule.EdgeSet = function(){
	Yule.EdgeSet.parse = function(data){
		var edgeSet = new Yule.EdgeSet();
		if (data != null)
		{
			var values = data.split(" ");
			var types = [Yule.DataTypes.Px, "%", Yule.DataTypes.PctW, Yule.DataTypes.PctH];
			if (values.length == 1)
			{
				edgeSet.t = Yule.Dim.parse(values[0], types);
				edgeSet.r = edgeSet.t.clone();
				edgeSet.b = edgeSet.t.clone();
				edgeSet.l = edgeSet.t.clone();
			}
			else if (values.length == 4)
			{
				edgeSet.t = Yule.Dim.parse(values[0], types);	
				edgeSet.r = Yule.Dim.parse(values[1], types);
				edgeSet.b = Yule.Dim.parse(values[2], types);
				edgeSet.l = Yule.Dim.parse(values[3], types);
			}
			
			if (edgeSet.t.type == "%")
				edgeSet.t.type = Yule.DataTypes.PctH;
			if (edgeSet.r.type == "%")
				edgeSet.r.type = Yule.DataTypes.PctW;
			if (edgeSet.b.type == "%")
				edgeSet.b.type = Yule.DataTypes.PctH;
			if (edgeSet.l.type == "%")
				edgeSet.l.type = Yule.DataTypes.PctW;
		}
		
		return edgeSet;
	};
	
	this.t = new Yule.Dim(0, Yule.DataTypes.Px);
	this.r = new Yule.Dim(0, Yule.DataTypes.Px);
	this.b = new Yule.Dim(0, Yule.DataTypes.Px);
	this.l = new Yule.Dim(0, Yule.DataTypes.Px);
};
Yule.EdgeSet.prototype.get = function(dimension, post){
	if (dimension == Yule.Dimensions.X)
	{
		if (post)
			return this.r;
		else
			return this.l;
	}
	else if (dimension == Yule.Dimensions.Y)
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
	if (type == Yule.DataTypes.Px || type == "%")
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
Yule.EdgeSet.prototype.toAbs = function(dimension, post, reference){
	return this.get(dimension, post).toAbs(reference);
};
Yule.EdgeSet.prototype.sumToAbs = function(dimension, reference){
	return this.toAbs(dimension, false, reference) + this.toAbs(dimension, true, reference);
};
Yule.EdgeSet.prototype.toString = function(reference){
	var t = this.toAbs(Yule.Dimensions.Y, false, reference);
	var r = this.toAbs(Yule.Dimensions.X, true, reference);
	var b = this.toAbs(Yule.Dimensions.Y, true, reference);
	var l = this.toAbs(Yule.Dimensions.X, false, reference);
	
	return t + Yule.DataTypes.Px + " " + r + Yule.DataTypes.Px + " " + b + Yule.DataTypes.Px + " " + l + Yule.DataTypes.Px;
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
	if (dimension == Yule.Dimensions.X)
		return this.h;
	else if (dimension == Yule.Dimensions.Y)
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