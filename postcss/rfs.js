'use strict';

const postcss = require('postcss');

module.exports = postcss.plugin('postcss-rfs', function (opts) {
  const BREAKPOINT_ERROR = 'breakpoint option is invalid, it must be set in `px`, `rem` or `em`.';
  const BREAKPOINT_UNIT_ERROR = 'breakpointUnit option is invalid, it must be `px`, `rem` or `em`.';
  const MINIMUM_FONT_SIZE_ERROR = 'minimumFontSize option is invalid, it must be set in `px` or `rem`.';
  const DISABLE_RESPONSIVE_FONT_SIZE_SELECTOR = '.disable-responsive-font-size';
  opts = opts || {};
  opts.minimumFontSize = opts.minimumFontSize || 16;
  opts.fontSizeUnit = opts.fontSizeUnit || 'rem';
  opts.breakpoint = opts.breakpoint || 1200;
  opts.breakpointUnit = opts.breakpointUnit || 'px';
  opts.factor = opts.factor || 5;
  opts.twoDimensional = opts.twoDimensional || false;
  opts.unitPrecision = opts.unitPrecision || 5;
  opts.generateDisableClasses = opts.generateDisableClasses || true;
  opts.remValue = opts.remValue || 16;
  opts.propList = opts.propList || ['responsive-font-size', 'rfs'];

  if (typeof opts.minimumFontSize !== 'number') {
    if (opts.minimumFontSize.endsWith('px')) {
      opts.minimumFontSize = parseFloat(opts.minimumFontSize);
    }
    else if (opts.minimumFontSize.endsWith('rem')) {
      opts.minimumFontSize = parseFloat(opts.minimumFontSize) / opts.remValue;
    }
    else {
      console.error(MINIMUM_FONT_SIZE_ERROR);
    }
  }

  if (typeof opts.breakpoint !== 'number') {
    if (opts.breakpoint.endsWith('px')) {
      opts.breakpoint = parseFloat(opts.breakpoint);
    }
    else if (opts.breakpoint.endsWith('em')) {
      opts.breakpoint = parseFloat(opts.breakpoint) * opts.remValue;
    }
    else {
      console.error(BREAKPOINT_ERROR);
    }
  }

  return function (css) {

    css.walkRules(function (rule) {

      if (rule.selector.includes(DISABLE_RESPONSIVE_FONT_SIZE_SELECTOR)){
        return;
      }

      rule.walkDecls(function (decl) {
        // Skip if property is not in propList.
        if (opts.propList.indexOf(decl.prop) === -1) {
          return;
        }

        // Set property to font-size.
        decl.prop = 'font-size';

        // Skip if value is not in px or rem.
        if (!new RegExp(/(\d*\.?\d+)(px|rem)/g).test(decl.value)) {
          return;
        }

        // Get the float value of the value.
        let value = parseFloat(decl.value);

        // Multiply by remValue if value is in rem.
        if (decl.value.indexOf('rem') > -1) {
          value *= opts.remValue;
        }

        // Render value in desired unit.
        if (opts.fontSizeUnit === 'px') {
          decl.value = toFixed(value, opts.unitPrecision) + 'px';
        }
        else if (opts.fontSizeUnit === 'rem') {
          decl.value = toFixed(value / opts.remValue, opts.unitPrecision) + 'rem';
        }
        else {
          console.error('fontSizeUnit option is not valid, it must be `px` or `rem`.');
        }

        // Only add media query if needed.
        if (opts.minimumFontSize >= value || opts.factor === 1) {
          return;
        }

        // Calculate font-size and font-size difference.
        let baseFontSize = opts.minimumFontSize + (value - opts.minimumFontSize) / opts.factor;
        const fontSizeDiff = value - baseFontSize;

        // Divide by remValue if needed.
        if (opts.fontSizeUnit === 'rem') {
          baseFontSize /= opts.remValue;
        }

        // Save selector for later.
        const rule_selector = rule.selector;

        // Disable classes.
        if (opts.generateDisableClasses) {
          const selectors = rule.selector.split(',');
          let ruleSelector = '';

          for (let selector of selectors) {
            ruleSelector += selector + ',\n';
            ruleSelector += DISABLE_RESPONSIVE_FONT_SIZE_SELECTOR + ' ' + selector + ',\n';
            ruleSelector += DISABLE_RESPONSIVE_FONT_SIZE_SELECTOR + selector + ',\n';
          }

          rule.selector = ruleSelector.slice(0, - 2);
        }

        const viewportUnit = opts.twoDimensional ? 'vmin' : 'vw';

        value = 'calc(' + toFixed(baseFontSize, opts.unitPrecision) + opts.fontSizeUnit + ' + ' + toFixed((fontSizeDiff * 100 / opts.breakpoint), opts.unitPrecision) + viewportUnit + ')';

        const mediaQuery = postcss.atRule(renderMediaQuery(opts));
        const mediaQueryRule = postcss.rule({
          selector: rule_selector,
          source: rule.source
        });
        mediaQueryRule.append(decl.clone({value: value}));
        mediaQuery.append(mediaQueryRule);
        rule.parent.insertAfter(rule, mediaQuery.clone());
      });
    });

  };

  function renderMediaQuery (opts) {
    const mediaQuery = {
      name: 'media'
    };

    switch (opts.breakpointUnit) {
      case 'em':
      case 'rem':
        const breakpoint = opts.breakpoint / opts.remValue;

        if (opts.twoDimensional) {
          mediaQuery.params = '(max-width: ' + breakpoint + opts.breakpointUnit + '), (max-height: ' + breakpoint + opts.breakpointUnit + ')';
        }
        else {
          mediaQuery.params = '(max-width: ' + breakpoint + opts.breakpointUnit + ')';
        }
        break;

      case 'px':
        if (opts.twoDimensional) {
          mediaQuery.params = '(max-width: ' + opts.breakpoint + 'px), (max-height: ' + opts.breakpoint + 'px)';
        }
        else {
          mediaQuery.params = '(max-width: ' + opts.breakpoint + 'px)';
        }
        break;

      default:
        console.error(BREAKPOINT_UNIT_ERROR);
        break;
    }

    return mediaQuery;
  }

  function toFixed (number, precision) {
    const multiplier = Math.pow(10, precision + 1),
      wholeNumber = Math.floor(number * multiplier);
    return Math.round(wholeNumber / 10) * 10 / multiplier;
  }
});