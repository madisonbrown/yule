/*
 * yule JavaScript Library Beta v0.5
 * https://github.com/madisonbrown/yule
 *
 * Copyright 2013 by Madison Brown
 * Released under the MIT license
 *
 * Date: 07-28-2013
 */
 
var calls = 0;
var calcs = 0;

function Yule(){};

Yule.XMLHelper = function(){};
Yule.XMLHelper.parse = function(xmlFile, callback){
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200)
			callback(xhr.responseXML);
	};
	xhr.open("GET", xmlFile, true);
	xhr.send(null);
};

Yule.Frame = function(){
	this.shell = new Yule.Container();
	this.scope = null;
};
Yule.Frame.prototype.inflate = function(xmlFile, document, scope){
	var _this = this;
	Yule.XMLHelper.parse(xmlFile, function(data){ 
		_this.build(data, document, scope); 
		_this.renderToScope();
	});
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
					entrySize += entry.outerSize(dimension, true);
				else
					entrySize = entry.aVector(entry.minSize, dimension);
				
				if (parallel)
					size += entrySize;
				else if (entrySize > size)
					size = entrySize;
			}
			
			if (parallel)
				size += (this.stack.length - 1) * this.manager.spacing(dimension);
			
			return size;
		};
		Yule.Container.StackManager.RenderGroup.prototype.aSize = function(dimension){
			return this.size(dimension, false);
		};
		Yule.Container.StackManager.RenderGroup.prototype.minSize = function(dimension){
			return this.size(dimension, true);
		};
		Yule.Container.StackManager.RenderGroup.prototype.freeSpacePerFill = function(dimension){
			if (this.manager.isParallel(dimension))
			{
				var freeSpace = this.manager.maxSize(dimension) - (this.size(dimension, true) - this.minFillSpace(dimension));
				var evenGroupSize = freeSpace / this.fillCount(dimension);
				var fillCount = this.fillCount(dimension);
				
				var overflow = 0;
				for (var i = 0; i < this.stack.length; i++)
				{
					var entry = this.stack[i];
					var entryType = entry.size.getType(dimension);
					if (entryType == Yule.DataTypes.Fill)
					{
						var minSize = entry.aVector(entry.minSize, dimension);
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
				return this.minSize(dimension);
		};
		Yule.Container.StackManager.RenderGroup.prototype.offsetOf = function(container, dimension){
			var offset = 0;
			var index = this.indexOf(container);
			if (index >= 0)
			{
				for (var i = 0; i < index; i++)
					offset += this.stack[i].outerSize(dimension, true);
					
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
		Yule.Container.StackManager.RenderGroup.prototype.minFillSpace = function(dimension){
			var minFillSpace = 0;
			for (var i = 0; i < this.stack.length; i++)
				if (this.stack[i].size.getType(dimension) == Yule.DataTypes.Fill)
					minFillSpace += this.stack[i].aVector(this.stack[i].minSize, dimension);
					
			return minFillSpace;
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
	Yule.Container.StackManager.prototype.remove = function(container){
		for (var i = 0; i < this.stack; i++)
		if (this.stack[i] === container)
			this.stack.splice(i, 1);
	};
	Yule.Container.StackManager.prototype.organize = function(){
		var _stackManager = this;
		function safeSizeOf(entry, container, dimension, outer){
			var entryType = entry.size.getType(dimension);
			var xEntryType = entry.size.getType(Yule.Dimensions.flip(dimension));
			
			var isFillPercent = false;
			var isMinFillPercent = false;
			if (container != null)
			{
				var heightIsFill = container.size.getType(Yule.Dimensions.Y) == Yule.DataTypes.Fill;
				var widthIsFill = container.size.getType(Yule.Dimensions.X) == Yule.DataTypes.Fill;
				
				var isFillPercent = (entryType == Yule.DataTypes.PctH && heightIsFill) ||
					(entryType == Yule.DataTypes.PctW && widthIsFill) ||
					(entryType == Yule.DataTypes.PctS && (heightIsFill || widthIsFill));
					
				var entryMinType = entry.minSize.getType(dimension);
				var isMinFillPercent = (entryMinType == Yule.DataTypes.PctH && heightIsFill) || 
					(entryMinType == Yule.DataTypes.PctW && widthIsFill) ||
					(entryMinType == Yule.DataTypes.PctS && (heightIsFill || widthIsFill));
				
				if (outer)	
				{
					var entryMarType = [entry.margin.getType(dimension, false), entry.margin.getType(dimension, true)];
					var isMarFillPercent = [
						(entryMarType[0] == Yule.DataTypes.PctH && heightIsFill) || (entryMarType[0] == Yule.DataTypes.PctW && widthIsFill) ||
							(entryMarType[0] == Yule.DataTypes.PctS && (heightIsFill || widthIsFill)),
						(entryMarType[1] == Yule.DataTypes.PctH && heightIsFill) || (entryMarType[1] == Yule.DataTypes.PctW && widthIsFill) ||
							(entryMarType[1] == Yule.DataTypes.PctS && (heightIsFill || widthIsFill))];
							
					if (!isMarFillPercent[0])
						size += entry.aMargin(dimension, true, false);
					if (!isMarFillPercent[1])
						size += entry.aMargin(dimension, false, true);
				}
			}
			
			var isFill = entryType == Yule.DataTypes.Fill;
			var isXFill =  xEntryType == Yule.DataTypes.Fill && 
				((dimension == Yule.Dimensions.Y && entryType == Yule.DataTypes.Exp) ||
				(dimension == Yule.Dimensions.X && entryType == Yule.DataTypes.Min));
				
			var size = 0;	
			if (!isFill && !isXFill && !isFillPercent)
				size += entry.aSize(dimension);
			else if (!isMinFillPercent)
				size += entry.aVector(entry.minSize, dimension);
				
			return size;
		}
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
			var xPType = this.container.size.getType(xDimension);
			var spacing = this.spacing(dimension);
			var xSpacing = this.spacing(xDimension);
			if (pType != Yule.DataTypes.Exp && pType != Yule.DataTypes.Min)
				var maxSize = safeSizeOf(this.container, this.container.parent, dimension, false) - this.container.aPadding(dimension, true, true);
			if (xPType != Yule.DataTypes.Exp && xPType != Yule.DataTypes.Min)
				var maxXSize = safeSizeOf(this.container, this.container.parent, xDimension, false) - this.container.aPadding(xDimension, true, true);
			
			var curGroup = null;
			var groupSize = [];
			var groupSpace = [];
			var xSize = 0;
			for (var i = 0; i < this.stack.length; i++)
			{
				var entry = this.stack[i];
				var entrySize = safeSizeOf(entry, this.container, dimension, true);
				
				if (pType != Yule.DataTypes.Min && maxGroups == null) //add entries filling each group before moving to the next.
				{
					var groupHasSpace = maxSize == null || (groupSize[curGroup] + spacing + entrySize) < maxSize;
					var canAppend = (maxEntries == null && !groupHasSpace) || (maxEntries != null && this.groups[curGroup].stack.length >= maxEntries);
					
					if (canAppend || curGroup == null)
						appendGroup();
					else
						groupSize[curGroup] += spacing;
				}
				else //add entries filling each group evenly along the way.
				{
					var entryXSize = safeSizeOf(entry, this.container, xDimension, true);
					var pendingXSize = xSize + entryXSize;
					if (curGroup != null && this.groups[curGroup].stack.length > 0)
						pendingXSize += spacing;
					var canAppend = (maxGroups != null && this.groups.length < maxGroups) || (maxGroups == null && pendingXSize <= maxXSize);
					
					if (canAppend || curGroup == null)
					{
						appendGroup()
						groupSpace[curGroup] = entryXSize;
						xSize = pendingXSize;
					}
					else
					{
						var next = 0;
						
						//make sure the next entry fits into at least one existing group by finding the first match
						if (xPType != Yule.DataTypes.Exp)
							while (next < this.groups.length && 
								(entryXSize > groupSpace[next] || (maxEntries != null && this.groups[next].stack.length >= maxEntries)))
								next++;
						
						//if it did, check all remaining groups to find the least-filled match
						if (next < this.groups.length)
							for (var j = next + 1; j < groupSize.length; j++)
							{
								var groupHasRoom = (maxEntries == null || this.groups[j].stack.length < maxEntries) && entryXSize <= groupSpace[j];
								if ((groupSize[j] < groupSize[next] || 
									(groupSize[j] == groupSize[next] && this.groups[j].stack.length < this.groups[next].stack.length)) && groupHasRoom)
									next = j;
							}
						//otherwise, just add it to the last group
						else
							next = this.groups.length - 1;
						
						curGroup = next;
						
						groupSize[curGroup] += spacing;
					}
				}
				
				//add the entry to the selected group	
				this.groups[curGroup].register(this.stack[i]);
				groupSize[curGroup] += entrySize;
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
			var groupSize = 0;
			var pType = this.container.size.getType(dimension);
			if (pType == Yule.DataTypes.Exp || pType == Yule.DataTypes.Min)
				groupSize = this.groups[i].minSize(dimension);
			else
				groupSize = this.groups[i].aSize(dimension);
			
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
			if (this.isParallel(dimension) || maxSize == null)
			{
				var freeSpace = group.freeSpacePerFill(dimension);
			}
			else
			{
				var thisIndex = this.indexOfGroup(group);
				var thisGroupSize = group.minSize(dimension);
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
							var groupSize = this.groups[i].minSize(dimension);
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
		
		return Math.floor(freeSpace);
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
						offset += this.groups[i].aSize(dimension) + spacing;
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
			if (this.stackStyle.style == Yule.Positions.Left || this.stackStyle.style == Yule.Positions.Right)
				return Yule.Dimensions.X;
			else if (this.stackStyle.style == Yule.Positions.Top || this.stackStyle.style == Yule.Positions.Bottom)
				return Yule.Dimensions.Y;
		}
		else
			return null;
	};
	Yule.Container.StackManager.prototype.perpDimension = function(){
		return Yule.Dimensions.flip(this.stackDimension());
	};
	Yule.Container.StackManager.prototype.spacing = function(dimension){
		return this.container.aVector(this.container.spacing, dimension);
	};
	Yule.Container.StackManager.prototype.maxSize = function(dimension){
		var maxSize = null;
		if (this.container.size.getType(dimension) != Yule.DataTypes.Exp)
			maxSize = this.container.innerSize(dimension, false);
			
		return maxSize;
	};
	Yule.Container.StackManager.prototype.groupCount = function(){
		if (this._organized)
			return this.groups.length;
		else if (this.container.stackGroups > 0)
			return this.container.stackGroups;
		else
			return null;
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

	this.id = null;
	this.offset = new Yule.Vector();
	this.size = new Yule.Vector();
	this.minSize = new Yule.Vector();
	this.maxSize = Yule.Vector.parse("* *");
	this.margin = new Yule.EdgeSet();
	this.padding = new Yule.EdgeSet();
	this.expand = new Yule.EdgeSet();	
	this.spacing = new Yule.Vector();
	this.stack = new Yule.StackStyle();
	this.stackGroups = null;
	this.childrenPerGroup = null;
	this.align = new Yule.AlignStyle();
	this.stackAlign = new Yule.AlignStyle();
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
	this._content = false;
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
	this.stackManager.remove(container);
	
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
Yule.Container.prototype.aRef = function(dimension){
	if (this.parent != null)
	{
		var ref = this;
		do
		{
			ref = ref.parent;
			var refType = ref.size.getType(dimension);
		} while((refType == Yule.DataTypes.Exp || refType == Yule.DataTypes.Min) && ref.parent != null);
		
		var refSize = ref.innerSize(dimension);
		if (ref.isStackingBy(Yule.Dimensions.flip(dimension)))
		{
			groups = ref.stackManager.groupCount();
			if (groups > 0)
				refSize -= (groups - 1) * ref.stackManager.spacing(dimension);
		}
		
		return refSize;
	}
	else
		return 0;
};
Yule.Container.prototype.refDim = function(vector, dimension)
{
	var type = vector.getType(dimension);
	if (Yule.DataTypes.isRelative(type))
	{
		if (type == Yule.DataTypes.PctW)
			return Yule.Dimensions.X;
		else if (type == Yule.DataTypes.PctH)
			return Yule.Dimensions.Y;
		else
		{
			var w = this.aRef(Yule.Dimensions.X);
			var h = this.aRef(Yule.Dimensions.Y);
			if (w < h)
				return Yule.Dimensions.X;
			else
				return Yule.Dimensions.Y;
		}
	}
	else
		return dimension;
}
Yule.Container.prototype.aVector = function(vector, dimension){
	var type = vector.getType(dimension);
	if (Yule.DataTypes.isRelative(type))
	{
		var refDim = this.refDim(vector, dimension);
		return vector.toAbs(dimension, this.aRef(refDim));
	}
	else
		return vector.toAbs(dimension, 0);
};
Yule.Container.prototype.aEdge = function(edgeSet, dimension, post){
	var type = edgeSet.getType(dimension, post);
	if (Yule.DataTypes.isRelative(type))
	{
		var refDim = this.refDim(vector, dimension);
		return edgeSet.toAbs(dimension, post, this.aRef(refDim));
	}
	else
		return edgeSet.toAbs(dimension, post, 0);
};
Yule.Container.prototype.aEdgeSum = function(edgeSet, dimension, tl, br){
	var edge = 0;
	if (tl)
		edge += this.aEdge(edgeSet, dimension, false);
	if (br)
		edge += this.aEdge(edgeSet, dimension, true);
	
	return edge;
};
Yule.Container.prototype.aMargin = function(dimension, tl, br){
	return this.aEdgeSum(this.margin, dimension, tl, br);
};
Yule.Container.prototype.aPadding = function(dimension, tl, br){
	var padding = 0;
	if (tl)
		padding += this.padding.toAbs(dimension, false, 0);
	if (br)
		padding += this.padding.toAbs(dimension, true, 0);
	
	return padding;
};
Yule.Container.prototype.aExpand = function(dimension, tl, br){
	var expand = 0;
	if (tl)
		expand += this.expand.toAbs(dimension, false, 0);
	if (br)
		expand += this.expand.toAbs(dimension, true, 0);
	
	return expand;
};
Yule.Container.prototype.aSize = function(dimension){
	calls++;
	if (this._sizeActive.getValue(dimension) == false) //prevent infinite loop
	{
		var aSize = 0;
		if (this._aSize.getValue(dimension) == null) //check to see if aSize has already been calculated this render cycle
		{
			calcs++;
			this._sizeActive.setValue(dimension, true);
			
			var type = this.size.getType(dimension);
			if (type == Yule.DataTypes.Px)
			{
				aSize = this.size.toAbs(dimension, 0);
			}
			else if (Yule.DataTypes.isRelative(type))
			{
				if (this.parent != null)
					aSize = this.aVector(this.size, dimension) - this.aMargin(dimension, true, true);
			}
			else if (type == Yule.DataTypes.Fill)
			{
				if (this.parent != null)
				{
					if (this.parent.isStacking() && this.parent.stackManager._organized)
						aSize = this.parent.stackManager.freeSpaceFor(this, dimension);
					else
						aSize = this.parent.innerSize(dimension);
					
					aSize -= this.aMargin(dimension, true, true);
				}
			}
			else
			{
				var padding = this.aPadding(dimension, true, true);
				
				if (this.isStacking())
					aSize += this.stackManager.aSize(dimension);
				
				if (type == Yule.DataTypes.Min && dimension == Yule.Dimensions.X)
				{
					if (!this.isStacking() && this.domObject != null)
					{
						for (var i = 0; i < this.children.length; i++)
						{
							var child = this.children[i];
							if (child.domObject != null)
							{
								this.domObject.style.width = 0;
								
								var availableHeight = null;
								var type = this.size.getType(Yule.Dimensions.Y);
								if (type != Yule.DataTypes.Exp && type != Yule.DataTypes.Min)
									availableHeight = this.innerSize(Yule.Dimensions.Y);
									
								if (availableHeight == 0)
									child.domObject.style.whiteSpace = "nowrap";
								else if (availableHeight != null)
									while(child.domObject.offsetHeight > availableHeight)
										this.domObject.style.width = this.domObject.offsetWidth + 1 + "px";
								
								if (child.domObject.offsetWidth > aSize);
										aSize = child.domObject.offsetWidth;
								
								this.domObject.style.width = "";
								child.domObject.style.whiteSpace = "normal";
							}
						}
					}
				}
				else //if (type == Yule.DataTypes.Exp) (or type = min and dimension is Y, same as min Y)
				{
					for (var i = 0; i < this.children.length; i++) //Fit to children
					{
						var cType = this.children[i].size.getType(dimension);
						if (cType != Yule.DataTypes.Fill)
						{
							var cSize = this.children[i].outerSize(dimension) + this.children[i].aVector(this.children[i].offset, dimension);
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
							if (this.parent != null)
							{
								var pType = this.parent.size.getType(dimension);
								if (pType == Yule.DataTypes.Exp || pType == Yule.DataTypes.Min)
									this.domObject.style.whiteSpace = "nowrap";
							}
							
							dSize = this.domObject.offsetWidth + 1;
							
							this.domObject.style.whiteSpace = "normal";
						}
						else if (dimension == Yule.Dimensions.Y)
							dSize = this.domObject.offsetHeight + 1;
						
						if (aSize < dSize)
							aSize = dSize;
					}
				}
				
				aSize += padding;
			}
			
			aSize += this.aExpand(dimension, true, true);
			
			var minSize = this.aVector(this.minSize, dimension);
			if (aSize < minSize)
				aSize = minSize;
				
			if (this.maxSize.getType(dimension) != Yule.DataTypes.Exp)
			{
				var maxSize = this.aVector(this.maxSize, dimension);
				if (aSize > maxSize)
					aSize = maxSize;
			}
			
			if (aSize < 0)
				aSize == 0;
			
			if (this.cache)
				this._aSize.setValue(dimension, aSize);
			this._sizeActive.setValue(dimension, false);
		}
		else
			aSize = this._aSize.getValue(dimension);
			
		return aSize;
	}
	else
	{
		alert("breach");
		return 0;
	}
};
Yule.Container.prototype.aPosition = function(dimension){
	if (this._positionActive.getValue(dimension) == false)
	{
		var aPos = 0;
		if (this._aPosition.getValue(dimension) == null)
		{
			this._positionActive.setValue(dimension, true);
			
			//At minimum, aPosition will include this containers specified offset and its top-left margin.
			aPos = this.aVector(this.offset, dimension) + this.aMargin(dimension, true, false) - this.aExpand(dimension, true, false);
			
			if (this.parent != null)//If this container has a parent:
			{
				//It will be further offset by its parent's aPosition...
				if (!this._content)
					aPos += this.parent.aPosition(dimension);
				
				//as well as its parent's top-left padding.
				aPos += this.parent.aPadding(dimension, true, false, false);
				
				//Additionally, if this container is part of a stack, it will be offset by that stack.
				if (this.parent.isStacking())
				{
					aPos += this.parent.stackManager.offsetOf(this, dimension);
					
					//And the stack can be aligned within this container.
					var alignStyle = this.parent.stackAlign.getStyle(dimension);
					
					var center = alignStyle == Yule.Positions.Center;
					var bottom = dimension == Yule.Dimensions.Y && alignStyle == Yule.Positions.Bottom;
					var right = dimension == Yule.Dimensions.X && alignStyle == Yule.Positions.Right;
					
					if (center || bottom || right)
					{
						var alignOffset = this.parent.innerSize(dimension, false) - this.parent.stackManager.aSize(dimension);
						if (center)
							alignOffset /= 2;
						
						aPos += Math.floor(alignOffset);
					}
				}
				
				if (!this.parent.isStackingBy(dimension)) //If it's not stacking in the current dimension, it can also be aligned independently
				{
					var alignStyle = this.align.getStyle(dimension);
					
					var center = alignStyle == Yule.Positions.Center;
					var bottom = dimension == Yule.Dimensions.Y && alignStyle == Yule.Positions.Bottom;
					var right = dimension == Yule.Dimensions.X && alignStyle == Yule.Positions.Right;
					
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
						
						aPos += Math.floor(alignOffset);
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
Yule.Container.prototype.outerSize = function(dimension){
	return this.aSize(dimension) + this.aMargin(dimension, true, true);
};
Yule.Container.prototype.innerSize = function(dimension){
	return this.aSize(dimension) - this.aPadding(dimension, true, true);
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
			content.size = Yule.Vector.parse("* *");
			if (this.size.getType(Yule.Dimensions.X) != Yule.DataTypes.Exp)
				content.size.setType(Yule.Dimensions.X, Yule.DataTypes.Fill);
			content.align = this.contentAlign;
			content._content = true;
			
			content.domObject = document.createElement("div");
			content.domObject.id = content.id;
			content.domObject.style.position = "absolute";
			content.domObject.innerHTML = this.domObject.innerHTML;
			
			this.domObject.innerHTML = "";
			this.domObject.appendChild(content.domObject);
			
			if (content.align.h == Yule.Positions.Center)
				content.domObject.style.textAlign = Yule.Positions.Center;
			else if (content.align.h == Yule.Positions.Right)
				content.domObject.style.textAlign = Yule.Positions.Right;
			
			this.addChild(content);
		}
	}
};
Yule.Container.prototype.build = function(nodes, document, referenceNode){	
	function getAttribute(node, attribute){
		var result = node.getAttribute(attribute);
		if (result == "undefined" || result == "NaN")
			return null;
		else if (result == "true" || result == "false")
			return result == "true";
		else
			return result;
	}
	
	for (var i = 0; i < nodes.length; i++)
	{
		if (nodes[i].tagName == "container")
		{
			var container = new Yule.Container();
			container.id = getAttribute(nodes[i], "id");
			container.offset = Yule.Vector.parse(getAttribute(nodes[i], "offset"));
			container.size = Yule.Vector.parse(getAttribute(nodes[i], "size"));
			container.minSize = Yule.Vector.parse(getAttribute(nodes[i], "minSize"));
			if (getAttribute(nodes[i], "maxSize") != null)
				container.maxSize = Yule.Vector.parse(getAttribute(nodes[i], "maxSize"));
			container.margin = Yule.EdgeSet.parse(getAttribute(nodes[i], "margin"));
			container.padding = Yule.EdgeSet.parse(getAttribute(nodes[i], "padding"));
			container.expand = Yule.EdgeSet.parse(getAttribute(nodes[i], "expand"));
			container.spacing = Yule.Vector.parse(getAttribute(nodes[i], "spacing"));
			container.stack = Yule.StackStyle.parse(getAttribute(nodes[i], "stack"));
			container.stackGroups = getAttribute(nodes[i], "stackGroups");
			container.childrenPerGroup = getAttribute(nodes[i], "childrenPerGroup");
			container.align = Yule.AlignStyle.parse(getAttribute(nodes[i], "align"));
			container.stackAlign = Yule.AlignStyle.parse(getAttribute(nodes[i], "stackAlign"));
			container.contentAlign = Yule.AlignStyle.parse(getAttribute(nodes[i], "contentAlign"));
			container.element = getAttribute(nodes[i], "element");
			container.className = getAttribute(nodes[i], "class");
			container.style = getAttribute(nodes[i], "style");
			container.isRender = getAttribute(nodes[i], "render");
			container.cache = getAttribute(nodes[i], "cache") || getAttribute(nodes[i], "cache") == null;
			
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
		
		var type = this.size.getType(Yule.Dimensions.Y);
		if (type == Yule.DataTypes.Exp || type == Yule.DataTypes.Min)
		{
			if (!this._sizeActive.getValue(Yule.Dimensions.X))
				this.domObject.style.width = this.aSize(Yule.Dimensions.X) + "px";
		}
		else if (!this._sizeActive.getValue(Yule.Dimensions.Y))
			this.domObject.style.height = this.aSize(Yule.Dimensions.Y) + "px";
		
		this._presizing = false;
	}
};
Yule.Container.prototype.postsizeDomObject = function(){	
	if (this.domObject != null)
	{
		var type = this.size.getType(Yule.Dimensions.Y);
		if (type == Yule.DataTypes.Exp || type == Yule.DataTypes.Min)
		{
			if (!this._sizeActive.getValue(Yule.Dimensions.Y))
				this.domObject.style.height = this.aSize(Yule.Dimensions.Y) + "px";
		}
		else if (!this._sizeActive.getValue(Yule.Dimensions.X))
			this.domObject.style.width = this.aSize(Yule.Dimensions.X) + "px";
			
		this._sizing = false;
	}
};
Yule.Container.prototype.positionElements = function(){
	this._positioning = true;
	
	if (this.domObject != null)
	{
		this.domObject.style.left = this.aPosition(Yule.Dimensions.X) + "px";
		this.domObject.style.top = this.aPosition(Yule.Dimensions.Y) + "px";
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
Yule.Container.prototype.affectChildren = function(affect){
	for (var i = 0; i < this.children.length; i++)
	{
		affect(this.children[i]);
		this.children[i].affectChildren(affect);
	}
};

Yule.DataTypes = function(){};
Yule.DataTypes.Px = "px";
Yule.DataTypes.PctH = "%h";
Yule.DataTypes.PctW = "%w";
Yule.DataTypes.PctS = "%s";
Yule.DataTypes.Fill = "fill";
Yule.DataTypes.Min = "min";
Yule.DataTypes.Exp = null;
Yule.DataTypes.isChildDependent = function(dataType){
	return dataType == Yule.DataTypes.Min || dataType == Yule.DataTypes.Exp;
};
Yule.DataTypes.isParentDependent = function(dataType){
	return dataType == Yule.DataTypes.Fill;
};
Yule.DataTypes.isRelative = function(dataType){
	return dataType == Yule.DataTypes.PctH || dataType == Yule.DataTypes.PctW || dataType == Yule.DataTypes.PctS;
};

Yule.Positions = function(){};
Yule.Positions.Top = "top";
Yule.Positions.Left = "left";
Yule.Positions.Bottom = "bottom";
Yule.Positions.Right = "right";
Yule.Positions.Center = "center";

Yule.Dimensions = function(){};
Yule.Dimensions.flip = function(dimension){
	if (dimension == Yule.Dimensions.X)
		return Yule.Dimensions.Y;
	else if (dimension == Yule.Dimensions.Y)
		return Yule.Dimensions.X;
};
Yule.Dimensions.X = "x";
Yule.Dimensions.Y = "y";

Yule.Dim = function(value, type){	
	this.value = value;
	this.type = type;
};
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
Yule.Dim.prototype.clone = function(){
	return new Yule.Dim(this.value, this.type);
};
Yule.Dim.prototype.toAbs = function(reference){
	if (this.type == Yule.DataTypes.Px)
		return this.value;
	else if (Yule.DataTypes.isRelative(this.type))
		return Math.round(reference * this.value / 100);
	else
		return 0;
};

Yule.Vector = function(){	
	this.x = new Yule.Dim(0, Yule.DataTypes.Px);
	this.y = new Yule.Dim(0, Yule.DataTypes.Px);
};
Yule.Vector.parse = function(data){
	var vector = new Yule.Vector();
	if (data != null)
	{
		var values = data.split(" ");
		var types = [Yule.DataTypes.Px, "%", Yule.DataTypes.PctW, Yule.DataTypes.PctH, Yule.DataTypes.PctS, Yule.DataTypes.Fill, Yule.DataTypes.Min];
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
	if (type == Yule.DataTypes.Px || type == Yule.DataTypes.PctW || type == Yule.DataTypes.PctH || type == Yule.DataTypes.Fill)
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
	this.t = new Yule.Dim(0, Yule.DataTypes.Px);
	this.r = new Yule.Dim(0, Yule.DataTypes.Px);
	this.b = new Yule.Dim(0, Yule.DataTypes.Px);
	this.l = new Yule.Dim(0, Yule.DataTypes.Px);
};
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
	
	return t + "px" + " " + r + "px" + " " + b + "px" + " " + l + "px";
};

Yule.StackStyle = function(){	
	this.style = null;
};
Yule.StackStyle.parse = function(data){
	var stackStyle = new Yule.StackStyle();
	if (data == Yule.Positions.Top || data == Yule.Positions.Bottom || data == Yule.Positions.Left || data == Yule.Positions.Right)
		stackStyle.style = data;
	
	return stackStyle;
};

Yule.AlignStyle = function(){	
	this.h = null;
	this.v = null;
};
Yule.AlignStyle.parse = function(data){
	var alignStyle = new Yule.AlignStyle();
	if (data != null)
	{
		var values = data.split(" ");
		if (values.length == 2)
		{
			if (values[0] == Yule.Positions.Left || values[0] == Yule.Positions.Center || values[0] == Yule.Positions.Right)
				alignStyle.h = values[0];
			if (values[1] == Yule.Positions.Top || values[1] == Yule.Positions.Center || values[1] == Yule.Positions.Bottom)
				alignStyle.v = values[1];
		}
	}
	
	return alignStyle;
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
