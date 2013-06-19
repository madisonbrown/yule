yule
====

<b>What is yule?</b>
Yule is a lightweight, layout engine developed in javascript that provides consitent, intrinsically-cross-platform structuring to web applications.


<b>Why use it?</b>
Cascading Style Sheets (CSS), the standard method of structuring in web applications, simply doesn't cut it. Not only does CSS lack several important capabilities, it is also implemented inconsistently accross platforms, and is not reimplemented often enough to keep up with the fast-paced evolution of the web. The result is is that in order to achieve relatively simple layout structures, often one must implement a long series of hacks and workarounds that increases development time and ultimately leads to fragile, dificult-to-maintain applications.

Consider that one cannot do the following using CSS alone:

 1. Set an element to fill available width or height within its parent container. (This is not the same as width/height:100% if there are other elements in the parent container.)
 2. Align any element top/center/bottom, left/center/right within any container, even if its size is unknown.
 3. Pad an element of unknown size, without increasing that elements size (For example, if a div is set to 100% of the window size, it cannot be padded without overflowing the window.)
 4. Automatically set all elements within a parent element to be equally spaced apart.
 5. Set the height of a floating element. Similarly, independently set shrink-wrapping behavior horizontally and vertically.
 6. Set elements to float in columns rather than rows (CSS3 seems to support columns but browser compatibility is not good)


<b>How does it work?</b>
Yule works by bypassing CSS for structure-related styling. It manually positions elements on the screen using absolutely positioned, non-nested divs with absolute widths and heights; therefore, yule structures are virtually guaranteed to render equally across browsers and platforms.

With CSS came the concept of separation of content and style. The concept behind yule is a further separation of style and structure. Therefore, a web page powered by yule is comprised of three components:

1. An HTML file containing all content in logical order.
2. An XML file specifying how that content should be arranged on the page.
3. A CSS stylesheet specifying superficial styling (colors, fonts, transparency, etc.)

This means that users who wish to view a plain-HTML version of a page structured by yule, such as the disabled or those who have chosen to disable javascript within their browser, may still do so.


<b>What is the format?</b>
A yule XML layout is composed of only one type of element, referred to as a container, which is specified using the \<container> tag and contains any of the following attributes:

    <container>

        id="{id}"

        offset="(px|%) &(px|%)" //top left

        size="(px|%|fill|*) &(px|%|fill|*)" //width height

        margin="(px|%)|[(px|%) &(px|%) &(px|%) &(px|%)]" //top right bottom left

        padding="(px|%)|[(px|%) &(px|%) &(px|%) &(px|%)]" //top right bottom left

        align="(left|center|right|*) &(top|center|bottom|*)" //horizontal vertical

        stack="(top|bottom|left|right)"

        spacing="(px) &(px)" //horizontal vertical

        element="{id}"

        render="(true|false)"

        style="{CSS style string}"

    </container>

By default, a container is aligned at the top-left corner of its parent, at size (0px, 0px), with no offset, margins or padding, or stacking or spacing.

The size of a container can be set in four ways:

1. Absolutely, in pixels 
2. Relatively, by percent
3. To fill any available space in its parent container
4. To expand to fit its contents

The width and height are independent, meaning that they can each be set to any of these types.

Margins and padding work in the same way as in CSS, except that in yule, the padding does not affect the size of the container. Rather, it affects the size of the child containers, if those containers are not sized absolutely (as it should be). Given a container, its margin will be relative to its parent container size, while its padding will be relative to its own size (if specified by percent).

Any container may be aligned within any other container left/center/right, top/center/bottom.

If multiple children are added to the same container, they will not affect eachother's positioning (meaning they may overlap), unless the 'stack' attribute is set on the parent container, in which case each child will be rendered one-after-another such that they do not overlap. A container may stack its children horizontally or vertically, starting from any of its sides.

A container may also specify the spacing between its children, overriding their margins such that they will be spaced evenly apart.

If multiple children within a stacking container are set to fill in the same direction, they will split the available space evenly.

The 'element' attribute is used to arrange the HTML content within the XML structure. If it is set to the id of any object in the body of the HTML file, that HTML object will be linked to the container.

By default, containers are not rendered to the screen (meaning they not produce any HTML DOM Object). Rather, yule arranges the HTML elements they are linked to within the document, as if those elements were contained by the specified containers. However, a container that is not linked to any existing element may be rendered anyway by setting its 'render' attribute to 'true'. In this case, yule will add a \<div> element to the HTML document which represents the container, and the id of the container will be transferred to this \<div> so that it can be referenced later.

Finally, CSS style strings specified within the 'style' attribute will be applied to the linked HTML objects, though any CSS attribute that would affect the position of that object will be overriden. CSS may also be applied within the HTML document using a stylesheet.