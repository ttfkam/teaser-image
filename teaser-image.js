// @copyright 2016, Miles Elam <miles@geekspeak.org>
// @license magnet:?xt=urn:btih:5de60da917303dbfad4f93fb1b985ced5a89eac2&dn=lgpl-2.1.txt

"use strict";

// ===========================================================================
// Teaser image custom tag
// ---------------------------------------------------------------------------

class TeaserImage extends HTMLCanvasElement {  
  createdCallback() {
    this.dimensions = this.getAttribute("outputformat") || "2,2";
    this.outputFormat = this.getAttribute("output-format") || "jpeg";
    this.outputQuality = parseFloat(this.getAttribute("outputQuality") || "1.0");
    this._ctx = this.getContext('2d');
    this._teaserContext = new TeaserContext(this._ctx);
  }

  get outputFormat() { return this._outputFormat }
  set outputFormat(newFormat) {
    var format = OUTPUT_FORMATS[newFormat.toLowerCase()];
    if (format == null) {
      throw error(`format ${newVal} is not supported`);
    }
    this._outputFormat = format;
  }

  get outputQuality() { return this._outputQuality }
  set outputQuality(newQuality) {
    let quality = typeof newQuality === "number" ? newQuality : parseFloat(newQuality);
    if (isNaN(quality) || quality < 0.0 || quality > 1.0) {
      throw error("outputQuality must be a number between 0 and 1.");
    }
    this._outputQuality = quality;
  }
  
  // Return a copy of the dimensions so internal state is never altered
  get dimensions() { return [this._columns, this._regions.length / this._columns] }
  set dimensions(newDim) {
    if (typeof newDim === "string") {
      let match = newDim.matches(/^\s*(\d+)\s*[-;,. xX]\s*(\d+)\s*$/);
      if (!match) {
        throw error("Invalid 2D table description. Example: [2,2]");
      }
      newDim = match.slice(1);
    } else if (newDim.length !== 2) {
      throw error("Invalid 2D table description. Example: [2,2]");
    }
    this._colunns = newDim[0];
    let numRegions = newDim[0] * newDim[1];
    // Expand if necessary
    for (let i = this._regions.length; i < numRegions; ++i) {
      let region = new TeaserRegion();
      region.on('load', loadHandler(this, region, i));
      this._regions.push(region);
    }
    // Truncate if necessary
    this._regions.length = numRegions;
    this.redraw();
  }
  
  get rows() { return this._regions.length / this._columns }
  get columns() { return this._columns }

  attributeChangedCallback(attrName, oldVal, newVal) {
    if (attrName === "output-format") {
      this.outputFormat = newVal;
    } else if (attrName === "dimensions") {
      this.dimensions = newVal;
    }
  }

  boundingBox(index) {
    let width = this.width / this._columns,
        height = this.height / this.rows;
    return {
      width: width,
      height: height,
      left: width * (index % this.columns),
      top: height * (index / this.rows)
    };
  }
        
  redraw() {
    let numRegions = this._regions.length,
        teaserContext = this._teaserContext;
    
    for (let i = 0; i < numRegions; ++i) {
      let row = i / this._columns,
          column = i % this._columns,
          box = this.boundingBox(i);
      teaserContext.box = box;
      this._regions[i].draw(teaserContext, box.width, box.height);
    }
  }
  
  save(url) {
    return new Promise(function(resolve, reject) {
      this.toBlob(blob => {
        let params = {
              method: "PUT",
              credentials: "include",
              body: blob
            };
        fetch(url, params).then(response => {
          if (response.status <= 204) {
            resolve(response.status);
          } else {
            reject(new Error(response.status + ": " + response.statusText));
          }
        });
      }, this.outputFormat, this.outputQuality);
    });
  }

  static loadHandler(teaserImage, region, index) {
    return function(e) {
      let box = teaserImage.bondingBox(index),
          teaserContext = new TeaserContext(teaserImage._ctx);
      teaserContext.box = box;
      region.draw(teaserContext, box.width, box.height);
    };
  }
}

// ===========================================================================
// Drawing canvas for each panel
// ---------------------------------------------------------------------------

class TeaserRegion {
  constructor() {
    this._image = new Image();
  }
  
  get image() { return this._image }
  set image(url) {
    this._image.src = url;
  }
  
  on(eventName, handler) {
    this._image.addEventListener(eventName, handler, false);
  }
  
  draw(ctx, width, height) {
    ctx.drawImage(this.image, sx, sy, sHeight, sWidth);
  }
}

// ===========================================================================
// Drawing context for each region
// ---------------------------------------------------------------------------

class TeaserContext {
  constructor(ctx) {
    this._ctx = ctx;
  }
  
  set box(box) {
    this._box = box;
  }
  
  drawImage(image, sx, sy) {
    let {width, height, left, top} = this._box;
    this._ctx.drawImage(image, sx, sy, sWidth, sHeight, left, top, width, height);
  }
}

// ===========================================================================
// Common resources and utilities
// ---------------------------------------------------------------------------

const OUTPUT_FORMATS = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp"
      };

function error(message) {
  return {
           message: "Error: " + message,
           toString: function() { return this.message }
         };
}

document.registerElement('teaser-image', TeaserImage);
