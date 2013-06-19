function Yule(){};
Yule.inflate = function(xmlFile, window){
	var page = new Yule.Page(window);
	page.build(Yule.XML.parse(xmlFile));
	
	return page;
};


Yule.XML = function(){};
Yule.XML.parse = function(xmlFile){
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.open("GET", xmlFile, false);
	xmlhttp.send();
	
	return xmlhttp.responseXML;
};

Yule.Page = function(window){
	this.window = window;
	this.shell = new Yule.Container();
};
Yule.Page.prototype.build = function(xmlDoc){
	this.shell.id = "shell";
	this.shell.build(xmlDoc.childNodes, this.window);
};
Yule.Page.prototype.render = function(){	
	this.shell.size = new Yule.Vector().set(
		parseFloat(this.window.innerWidth),
		parseFloat(this.window.innerHeight),
		"px", "px");
	this.shell.reset();
	this.shell.render();
};

Yule.Container = function(){
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
			for (var i = 0; i < this.stack.length; i++)
				if (this.stack[i].size.getType(dimension) != "fill")
					aSize += this.stack[i].outerSize(dimension);
				else
					aSize += this.stack[i].margin.sumToAbs(dimension, this.stack[i].parent, true);
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
					var childSize = this.stack[i].margin.sumToAbs(dimension, this.stack[i].parent, true);
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
			var vertical = this.isVertical();
			if (vertical && this.stackStyle.style == "top" || !vertical && this.stackStyle.style == "left")
			{
				var i = 0;
				while (i < this.stack.length && this.stack[i] != container)
					offset += this.stack[i++].outerSize(dimension);
			}
			else
			{
				var i = this.stack.length - 1;
				while (i >= 0 && this.stack[i] != container)
					offset += this.stack[i--].outerSize(dimension);
			}
		}
		
		return offset;
	};
	Yule.Container.StackManager.prototype.indexOf = function(container){
		var i = 0;
		while (i < this.stack.length && this.stack[i] != container)
			i++;
			
		return i;
	};

	this.id = null;
	this.offset = new Yule.Vector();
	this.size = new Yule.Vector();
	this.margin = new Yule.EdgeSet();
	this.padding = new Yule.EdgeSet();
	this.spacing = new Yule.Vector();
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
	container.parent = this;
	if (this.stack.style != null)
		this.stackManager.register(container);
	this.children[this.children.length] = container;
};
Yule.Container.prototype.aSize = function(dimension){
	if (this._sizeActive.getValue(dimension) == false)
	{
		if (this._aSize.getValue(dimension) == null) //Check to see if aSize has already been calculated this render cycle.
		{
			this._sizeActive.setValue(dimension, true);
			
			var aSize = 0;
			var sizeType = this.size.getType(dimension); //Get the type of this containers specified size.
			
			if (sizeType == "px" || sizeType == "%")
				aSize = this.size.toAbs(dimension, this.parent, true);
			else if (sizeType == "fill" && this.parent != null)
			{
				var fillers = this.parent.stackManager.fillers(dimension);
				if (fillers > 0) //If this container is filling a stack:
				{
					//aSize equals the free space of the parent divided by the number of fillers in the stack, adjusted for non-integer results.
					var unrounded = this.parent.freeSpace(dimension) / fillers - this.offset.toAbs(dimension, this.parent, true);
					aSize = Math.floor(unrounded);
					if (unrounded - aSize != 0 && this.parent.stackManager.indexOf(this) == Math.round((this.parent.stackManager.stack.length - 1) / 2))
						aSize++;
				}
				else //Otherwise, aSize equals innerSize of the parent minus this containers margins.
					aSize = this.parent.innerSize(dimension) - this.margin.sumToAbs(dimension, this.parent, true);
			}
			else if (sizeType == null) //If the type of this containers specified size is undefined, it should expand to fit its contents:
			{
				//At minimum, aSize of this containers will equal its padding, relative to itself (in case of %). 
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
	if (dimension == "x" || dimension == "y")
		return this.innerSize(dimension) - this.stackManager.aSize(dimension);
	else
		return 0;
};
Yule.Container.prototype.build = function(nodes, window){
	function applySpacing(container, spacing){
		function applyPadding(container, value, dimension){
			function applyMargin(container){
				if (container.children.length == 0 || container.stack.style == null)
				{
					container.margin.setValue(dimension, false, s);
					container.margin.setValue(dimension, true, s);
				}
				else
					for (var i = 0; i < container.children.length; i++)
						applyMargin(container.children[i]);
			}
			
			var s = Math.floor(value / 2);
			if (s > 0)
			{
				container.padding.setValue(dimension, false, s + container.padding.getValue(dimension, false));
				container.padding.setValue(dimension, true, s + container.padding.getValue(dimension, true));
				
				applyMargin(container);
			}
		}
		
		applyPadding(container, spacing.getValue("x"), "x");
		applyPadding(container, spacing.getValue("y"), "y");
	}
	
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
			container.spacing = Yule.Vector.parse(nodes[i].getAttribute("spacing"));
			container.stack = Yule.StackStyle.parse(nodes[i].getAttribute("stack"));
			container.stackManager = new Yule.Container.StackManager(container.stack); //FIX
			container.align = Yule.AlignStyle.parse(nodes[i].getAttribute("align"));
			container.element = nodes[i].getAttribute("element");
			container.className = nodes[i].getAttribute("class");
			container.isRender = nodes[i].getAttribute("render");
			container.style = nodes[i].getAttribute("style");
			
			if (container.element != null)
				container.domObject = window.document.getElementById(container.element);
			else if (container.isRender == "true")
			{
				container.domObject = window.document.createElement("div");
				container.domObject.id = container.id;
				window.document.body.appendChild(container.domObject);
			}
			
			this.addChild(container.build(nodes[i].childNodes, window));
			
			applySpacing(this, this.spacing);
		}
	}
	
	return this;
};
Yule.Container.prototype.render = function(){
	if (this.domObject != null)
	{
		this.domObject.className = this.className;
		this.domObject.style.cssText = this.style;
		this.domObject.style.position = "absolute";
		this.domObject.style.overflow = "hidden";
		this.domObject.style.left = this.aPosition("x") + "px";
		this.domObject.style.top = this.aPosition("y") + "px";
		this.domObject.style.width = this.aSize("x") + "px";
		this.domObject.style.height = this.aSize("y") + "px";
	}
	
	for (var i = 0; i < this.children.length; i++)
		this.children[i].render();
};
Yule.Container.prototype.reset = function(){
	this._aSize = new Yule.Vector().set(null, null, "px", "px");
	this._aPosition = new Yule.Vector().set(null, null, "px", "px");
	this._sizeActive = new Yule.Vector().set(false, false, null, null);
	this._positionActive = new Yule.Vector().set(false, false, null, null);
	
	for (var i = 0; i < this.children.length; i++)
		this.children[i].reset();
};

Yule.Vector = function(){
	Yule.Vector.parse = function(data){
		var vector = new Yule.Vector();
		if (data != null)
		{
			var values = data.split(" ");
			if (values.length == 2)
			{
				var pattern = /[^0-9]/;
				
				var match = pattern.exec(values[0]);
				if (match != null)
				{
					vector.x = parseFloat(values[0].slice(0, match.index));
					var typeX = values[0].slice(match.index);
					if (typeX == "px" || typeX == "%" || typeX == "fill")
						vector.typeX = typeX;
					else
						vector.typeX = null;
				}
	
				var match = pattern.exec(values[1]);
				if (match != null)
				{
					vector.y = parseFloat(values[1].slice(0, match.index));
					var typeY = values[1].slice(match.index);
					if (typeY == "px" || typeY == "%" || typeY == "fill")
						vector.typeY = typeY;
					else
						vector.typeY = null;
				}
			}
		}
		
		return vector;
	};
	
	this.x = this.y = 0;
	this.typeX = this.typeY = "px";
};
Yule.Vector.prototype.set = function(x, y, typeX, typeY){
	this.x = x;
	this.y = y;
	this.typeX = typeX;
	this.typeY = typeY;
	
	return this;
};
Yule.Vector.prototype.getValue = function(dimension){
	if (dimension == "x")
		return this.x;
	else if (dimension == "y")
		return this.y;
	else
		return 0;
};
Yule.Vector.prototype.getType = function(dimension){
	if (dimension == "x")
		return this.typeX;
	else if (dimension == "y")
		return this.typeY;
	else
		return null;
};
Yule.Vector.prototype.setValue = function(dimension, value){
	if (dimension == "x")
		this.x = value;
	else if (dimension == "y")
		this.y = value;
};
Yule.Vector.prototype.setType = function(dimension, type){
	if (type == "px" || type == "%" || type == "fill")
		if (dimension == "x")
			this.typeX = type;
		else if (dimension == "y")
			this.typeY = type;
	else
		if (dimesion == "x")
			this.typeX = null;
		else if (dimension == "y")
			this.typeY = null;
};
Yule.Vector.prototype.toAbs = function(dimension, refContainer, inner){
	var type = this.getType(dimension);
	if (type == "px")
		return this.getValue(dimension);
	else if (type == "%" && refContainer != null)
	{
		var reference = 0;
		if (inner)
			reference = refContainer.innerSize(dimension);
		else
			reference = refContainer.aSize(dimension);
			
		return Math.round(reference * this.getValue(dimension) / 100);
	}
	else
		return 0;
};

Yule.EdgeSet = function(){
	Yule.EdgeSet.parse = function(data){
		var edgeSet = new Yule.EdgeSet();
		if (data != null)
		{
			function parseEntry(data, destValue, destType){
				var pattern = /[^0-9]/;
				var match = pattern.exec(data);
				destValue = parseFloat(data.slice(0, match.index));
				var type = data.slice(match.index);
				if (type == "px" || type == "%")
					destType = type;
				else
					destType = null;
			}
			
			var values = data.split(" ");
			if (values.length == 1)
			{
				var pattern = /[^0-9]/;
				
				var match = pattern.exec(values[0]);
				if (match != null)
				{
					edgeSet.t = edgeSet.r = edgeSet.b = edgeSet.l = parseFloat(values[0].slice(0, match.index));
					var type = values[0].slice(match.index);
					if (type == "px" || type == "%")
						edgeSet.typeT = edgeSet.typeR = edgeSet.typeB = edgeSet.typeL = type;
					else
						edgeSet.typeT = edgeSet.typeR = edgeSet.typeB = edgeSet.typeL = null;
				}
			}
			else if (values.length == 4)
			{
				var pattern = /[^0-9]/;
				
				var match = pattern.exec(values[0]);
				if (match != null)
				{
					edgeSet.t = parseFloat(values[0].slice(0, match.index));
					var type = values[0].slice(match.index);
					if (type == "px" || type == "%")
						edgeSet.typeT = type;
					else
						edgeSet.typeT = null;
				}

				var match = pattern.exec(values[1]);
				if (match != null)
				{
					edgeSet.r = parseFloat(values[1].slice(0, match.index));
					var type = values[1].slice(match.index);
					if (type == "px" || type == "%")
						edgeSet.typeR = type;
					else
						edgeSet.typeR = null;
				}
					
				var match = pattern.exec(values[2]);
				if (match != null)
				{
					edgeSet.b = parseFloat(values[2].slice(0, match.index));
					var type = values[2].slice(match.index);
					if (type == "px" || type == "%")
						edgeSet.typeB = type;
					else
						edgeSet.typeB = null;
				}
					
				var match = pattern.exec(values[3]);
				if (match != null)
				{
					edgeSet.l = parseFloat(values[3].slice(0, match.index));
					var type = values[3].slice(match.index);
					if (type == "px" || type == "%")
						edgeSet.typeL = type;
					else
						edgeSet.typeL = null;
				}
			}
		}
		
		return edgeSet;
	};
	
	this.t = this.r = this.b = this.l = 0;
	this.typeT = this.typeR = this.typeB = this.typeL = "px";
};
Yule.EdgeSet.prototype.getValue = function(dimension, post){
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
		return 0;
};
Yule.EdgeSet.prototype.getType = function(dimension, post){
	if (dimension == "x")
	{
		if (post)
			return this.typeR;
		else
			return this.typeL;
	}
	else if (dimension == "y")
	{
		if (post)
			return this.typeB;
		else
			return this.typeT;
	}
	else
		return null;
};
Yule.EdgeSet.prototype.setValue = function(dimension, post, value){
	if (dimension == "x")
	{
		if (post)
			this.r = value;
		else
			this.l = value;
	}
	else if (dimension == "y")
	{
		if (post)
			this.b = value;
		else
			this.t = value;
	}
};
Yule.EdgeSet.prototype.setType = function(dimension, post, type){
	if (type == "px" || type == "%")
	{
		if (dimension == "x")
		{
			if (post)
				this.typeR = type;
			else
				this.typeL = type;
		}
		else if (dimension == "y")
		{
			if (post)
				this.typeB = type;
			else
				this.typeT = type;
		}
	}
};
Yule.EdgeSet.prototype.toAbs = function(dimension, post, refContainer, inner){
	var type = this.getType(dimension, post);
	if (type == "px")
		return this.getValue(dimension, post);
	else if (type == "%" && refContainer != null)
	{
		var reference = 0;
		if (inner)
			reference = refContainer.innerSize(dimension);
		else
			reference = refContainer.aSize(dimension);
		
		return Math.round(reference * this.getValue(dimension, post) / 100);
	}
	else
		return 0;
};
Yule.EdgeSet.prototype.sumToAbs = function(dimension, refContainer, inner){
	return this.toAbs(dimension, false, refContainer, inner) + this.toAbs(dimension, true, refContainer, inner);
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