/*!
 * yule JavaScript Library Beta v0.1
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

Yule.Page = function(window){
	this.window = window;
	this.shell = new Yule.Container();
};
Yule.Page.prototype.inflate = function(xmlFile){
	page.build(Yule.XMLHelper.parse(xmlFile));
};
Yule.Page.prototype.build = function(xmlDoc){
	this.shell.id = "shell";
	this.shell.build(xmlDoc.childNodes, this.window);
};
Yule.Page.prototype.render = function(){	
	this.shell.size = new Yule.Vector().set(
		new Yule.Dim(parseFloat(this.window.innerWidth), "px"),
		new Yule.Dim(parseFloat(this.window.innerHeight), "px"));
	this.shell.reset();
	this.shell.render();
};

Yule.Container = function(){
	var _parent = this;
	Yule.Container.StackManager = function(stackStyle){
		this.stack = [];
		this.stackStyle = stackStyle;
	}
	Yule.Container.StackManager.prototype.isVertical = function(){
		var vertical = null;
		if (this.stackStyle.style == "left" || this.stackStyle.style == "right")
			vertical = false;
		else if (this.stackStyle.style == "top" || this.stackStyle.style == "bottom")
			vertical = true;
		
		return vertical;
	};
	Yule.Container.StackManager.prototype.register = function(container){
		this.stack[this.stack.length] = container;
	};
	Yule.Container.StackManager.prototype.aSize = function(dimension){
		var aSize = 0;
		if (this.isParallel(dimension))
		{
			var spacing = _parent.spacing.toAbs(_parent, true);
			for (var i = 0; i < this.stack.length; i++)
			{
				if (this.stack[i].size.getType(dimension) != "fill")
					aSize += this.stack[i].outerSize(dimension);
				else
					aSize += this.stack[i].margin.sumToAbs(dimension, _parent, true);
					
				if (i < this.stack.length - 1)
					aSize += spacing
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
						aSize += childSize;
				}
				else
				{
					var childSize = this.stack[i].margin.sumToAbs(dimension, _parent, true);
					if (childSize > aSize)
						aSize += childSize;
				}
			}
		}
		
		return aSize;
	};
	Yule.Container.StackManager.prototype.fillers = function(dimension){
		var fillers = 0
		var vertical = this.isVertical();
		if ((vertical && dimension == "y") || (!vertical && dimension == "x"))
			for (var i = 0; i < this.stack.length; i++)
				if (this.stack[i].size.getType(dimension) == "fill")
					fillers++;
					
		return fillers;
	};
	Yule.Container.StackManager.prototype.isParallel = function(dimension){
		var vertical = this.isVertical();
		if (vertical != null)
			return (!vertical && dimension == "x") || (vertical && dimension == "y");
	};
	Yule.Container.StackManager.prototype.offsetOf = function(container, dimension){
		var offset = 0;
		if (this.isParallel(dimension))
		{
			var spacing = _parent.spacing.toAbs(dimension, _parent, true);
			var vertical = this.isVertical();
			if (vertical && this.stackStyle.style == "top" || !vertical && this.stackStyle.style == "left")
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
	};
	Yule.Container.StackManager.prototype.indexOf = function(container){
		var i = 0;
		while (i < this.stack.length && this.stack[i] !== container)
			i++;
			
		return i;
	};

	this.id = null;
	this.offset = new Yule.Vector();
	this.size = new Yule.Vector();
	this.margin = new Yule.EdgeSet();
	this.padding = new Yule.EdgeSet();
	this.spacing = new Yule.Dim();
	this.stack = new Yule.StackStyle();
	this.align = new Yule.AlignStyle();
	this.element = null;
	this.className = null;
	this.isRender = false;
	this.style = null;
	
	this.parent = null;
	this.children = [];
	this.stackManager = new Yule.Container.StackManager(this.stack);
	
	this.domObject = null;
};
Yule.Container.prototype.isStacking = function(dimension){
	return (this.stackManager.stackStyle.style != null && this.stackManager.isParallel(dimension));
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
				aSize = this.size.toAbs(dimension, this.parent, true);
				
				if(sizeType == "%") //If specified size is percent, then size includes this containers margins.
					aSize -= this.margin.sumToAbs(dimension, this.parent, true);
			}
			else if (sizeType == "fill" && this.parent != null)
			{
				var fillers = this.parent.stackManager.fillers(dimension);
				if (fillers > 0) //If this container is filling a stack:
				{
					//aSize equals the free space of the parent divided by the number of fillers in the stack, adjusted for non-integer results.
					var unrounded = this.parent.freeSpace(dimension) / fillers; //FIX: take into account offset.
					aSize = Math.floor(unrounded);
					if (unrounded - aSize != 0 && this.parent.stackManager.indexOf(this) == Math.round((this.parent.stackManager.stack.length - 1) / 2))
						aSize++;
				}
				else //Otherwise, aSize equals innerSize of the parent minus this containers margins.
					aSize = this.parent.innerSize(dimension) - this.margin.sumToAbs(dimension, this.parent, true);
			}
			else if (sizeType == null) //If the type of this containers specified size is undefined, it should expand to fit its contents:
			{
				//At minimum, aSize of this container will equal its padding, relative to itself (in case of %). 
				aSize = this.padding.sumToAbs(dimension, this, false); 
				
				if (this.isStacking(dimension)) //If this container is stacking:
					aSize += this.stackManager.aSize(dimension); //Get the size from the StackManager.
				else
					for (var i = 0; i < this.children.length; i++) //Otherwise, get the max size of the child containers.
					{
						var childType = this.children[i].size.getType(dimension);
						if (childType == "px" || childType == null)
						{
							var childSize = this.children[i].outerSize(dimension);
							if (childSize > aSize)
								aSize += childSize;
						}
					}
				

				if (this.domObject != null) //Now check to see if the domObjects content will fit...
				{
					if (!this._presizing && !this._rendering && !this._rendered) //make sure the domObjects dimensions are set in the correct order
						this.presizeDomObject();
						
					var dSize = 0;
					if (dimension == "x")
						dSize = this.domObject.offsetWidth;
					else if (dimension == "y")
						dSize = this.domObject.offsetHeight;
					
					var maximum = this.parent.freeSpace(dimension) - this.margin.sumToAbs(dimension, this.parent, true);
					if (aSize < dSize)
					{
						if(dSize < maximum) //and dont exceed available space within the parent.
							aSize = dSize;
						else
							aSize = maximum;
					}
				}
			}
			
			this._aSize.setValue(dimension, aSize);
			this._sizeActive.setValue(dimension, false);
		}
			
		return this._aSize.getValue(dimension);
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
				//It will be further offset by its parent's aPosition as well as its parent's top-left padding.
				aPos += this.parent.aPosition(dimension) + this.parent.padding.toAbs(dimension, false, this.parent, false);
				
				//Additionally, if this container is part of a stack, it will be further offset by that stack.
				if (this.parent.isStacking(dimension))
					aPos += this.parent.stackManager.offsetOf(this, dimension);
				else
				{
					//Otherwise, if this container is aligned within its parent, it will be offset accordingly.
					var alignStyle = this.align.getStyle(dimension);
					if (alignStyle == "center")
						aPos += this.parent.innerSize(dimension) / 2 - this.outerSize(dimension) / 2;
					else if ((dimension == "y" && alignStyle == "bottom") || (dimension == "x" && alignStyle == "right"))
						aPos += this.parent.innerSize(dimension) - this.outerSize(dimension);
				}
			}
				
			this._aPosition.setValue(dimension, aPos);
			this._positionActive.setValue(dimension, false);
		}
			
		return this._aPosition.getValue(dimension);
	}
	else
		return 0;
};
Yule.Container.prototype.freeSpace = function(dimension){
	if (this.stackManager.isParallel(dimension))
		return this.innerSize(dimension) - this.stackManager.aSize(dimension);
	else
		return this.innerSize(dimension);
};
Yule.Container.prototype.build = function(nodes, window){	
	for (var i = 0; i < nodes.length; i++)
	{
		if (nodes[i].tagName == "container")
		{
			var container = new Yule.Container();
			
			container.id = nodes[i].getAttribute("id");
			container.offset = Yule.Vector.parse(nodes[i].getAttribute("offset"));
			container.size = Yule.Vector.parse(nodes[i].getAttribute("size"));
			container.margin = Yule.EdgeSet.parse(nodes[i].getAttribute("margin"));
			container.padding = Yule.EdgeSet.parse(nodes[i].getAttribute("padding"));
			container.spacing = Yule.Dim.parse(nodes[i].getAttribute("spacing"), ["px", "%"]);
			container.stack = Yule.StackStyle.parse(nodes[i].getAttribute("stack"));
			container.align = Yule.AlignStyle.parse(nodes[i].getAttribute("align"));
			container.element = nodes[i].getAttribute("element");
			container.className = nodes[i].getAttribute("class");
			container.isRender = nodes[i].getAttribute("render");
			container.style = nodes[i].getAttribute("style");
			
			container.stackManager = new Yule.Container.StackManager(container.stack);
			
			if (container.element != null)
				container.domObject = window.document.getElementById(container.element);
			else if (container.isRender == "true")
			{
				container.domObject = window.document.createElement("div");
				container.domObject.style.zIndex = 0;
				container.domObject.id = container.id;
				window.document.body.insertBefore(container.domObject, document.body.firstChild);
			}
			if (container.domObject != null)
			{
				container.domObject.className = container.className;
				container.domObject.style.cssText = container.style;
				container.domObject.style.position = "absolute";
				container.domObject.style.overflow = "hidden";
				container.domObject.style.padding = container.padding.toString(null, true);
			}
			
			this.addChild(container.build(nodes[i].childNodes, window));
		}
	}
	
	return this;
};
Yule.Container.prototype.render = function(){
	this._rendering = true;
	
	if (this.domObject != null)
	{
		this.presizeDomObject();
		this.postsizeDomObject();
		this.domObject.style.left = this.aPosition("x") + "px";
		this.domObject.style.top = this.aPosition("y") + "px";
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
		if (this.size.typeY == null)
			this.domObject.style.width = this.innerSize("x") + "px";
		else
			this.domObject.style.height = this.innerSize("y") + "px";
		this._presizing = false;
	}
};
Yule.Container.prototype.postsizeDomObject = function(){
	if (this.domObject != null)
	{
		if (this.size.typeY == null)
			this.domObject.style.height = this.innerSize("y") + "px";
		else
			this.domObject.style.width = this.innerSize("x") + "px";
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
		this.domObject.style.height = "";
		this.domObject.style.width = "";
	}
		
	for (var i = 0; i < this.children.length; i++)
		this.children[i].reset();
		
	this._rendered = false;
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
				var types = ["px", "%", "fill"];
				vector.x = Yule.Dim.parse(values[0], types);
				vector.y = Yule.Dim.parse(values[1], types);
			}
		}
		
		return vector;
	};
	
	this.x = new Yule.Dim(0, "px");
	this.y = new Yule.Dim(0, "px");
};
Yule.Vector.prototype.set = function(x, y){
	this.x = x;
	this.y = y;
	
	return this;
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