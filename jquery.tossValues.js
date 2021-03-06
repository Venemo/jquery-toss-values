﻿
/*
Toss values
jQuery plugin that will help collect values from the DOM into an object,
also performing some amount of client-side validation.

----------

Copyright (c) 2013, Sense/Net Inc. http://www.sensenet.com/
Created by Timur Kristóf
Licensed to you under the terms of the MIT License

----------

Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify,
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be included in all copies
or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

(function ($, undefined) {

    // The default options for the functions in this module
    var defaultOptions = {
        // Parameters
        compulsoryMessage: "Field is required",
        invalidFormatMessage: "Invalid field",
        autoFocusErroredField: false,
        autoValidationOnKeyup: true,
        aspNetMvcCompatible: true,

        // Customizable attribute names
        fieldNameAttr: "data-fieldname",
        convertAttr: "data-convert",
        compulsoryAttr: "data-compulsory",
        validatorOfAttr: "data-validated-fieldname",
        createArrayAttr: "data-createarray",
        interpretValueAttr: "data-interpret",
        customFillValueAttr: "data-customfill",
        validateValueAttr: "data-validate",
        customInvalidFormatMessageAttr: "data-invalidformatmessage",
        dontSaveAttr: "data-dontsave",

        // Customizable jQuery data keys
        validationRulesKey: "tossvalues-validation-rules"
    };

    // custom console log function that can be enabled and disabled
    var consoleLog = function () {
        if ($.tossValues.consoleLogEnabled) {
            console.log.apply(console, arguments);
        }
    };

    // Converts a field to the specified type
    var convertField = function (rawValue, converter) {
        var convertedValue = rawValue;
        if (convertedValue && converter) {
            try {
                var conversionFunction = eval("0, " + /* <-- IE8 fix */ converter);
                if (typeof (conversionFunction) === "function") {
                    convertedValue = conversionFunction(rawValue);
                }
            }
            catch (err) {
                consoleLog(err);
                convertedValue = null;
            }
        }
        return convertedValue;
    };

    // Gets a value from a DOM element (used by the default interpret implementation)
    var getValueFromElement = function (options, $e, $context) {
        var rawValue = null;
        var convertedValue = null;

        if ($e.is("input[type=radio],input[type=checkbox]")) {
            // If the element is a radio button or checkbox
            var valueAttr = $e.attr("value");

            // When it doesn't have a special value: return whether it's checked or not
            // NOTE: ASP.NET MVC's HTML helper generates value="true" for check boxes
            if (!valueAttr || (options.aspNetMvcCompatible && valueAttr === "true" && $e.is("[data-val]")))
                rawValue = $e.is(":checked");
            // When it has a special value: return its value if checked, otherwise null
            else
                rawValue = $e.is(":checked") ? $e.val() : null;
        }
        else if ($e.is("input,textarea,select")) {
            // For other input fields, this returns their value
            rawValue = $e.val();

            // Empty string means null here
            if (rawValue === "") {
                rawValue = null;
            }
        }
        else {
            // And for non-input elements their html content
            rawValue = $e.html();
        }

        // Convert the value using the specified conversion function, if specified
        convertedValue = convertField(rawValue, $e.attr(options.convertAttr));

        return {
            rawValue: rawValue,
            convertedValue: convertedValue
        };
    };

    // Checks validation rules on an element
    var checkValidationRules = function (options, validation) {
        // Look at this
        var $this = $(this);

        // Get rules
        var rules = $this.data(options.validationRulesKey);

        // If there are no rules, we're okay
        if (!rules)
            return;

        // Go through all rules
        for (var i = 0; i < rules.length; i++) {
            var result = rules[i].call($this);
            // No result or true means validation is OK
            if (typeof (result) === "undefined" || result === true)
                continue;

            // Otherwise we have an error
            validation.isInvalid = true;
            if (typeof (result) === "string")
                validation.errorMessage = result;
            return;
        }
    };

    // Interprets the value of an element and performs the default validation on it
    // Output: { rawValue: ..., convertedValue: ..., isMissing: ..., isInvalid: ...  }
    var interpretElement = function (options, $context) {
        var $this = $(this);
        var v;
        var usedCustomInterpret = false;
        var isCompulsory = $this.attr(options.compulsoryAttr) === "true";

        // Check if the element has a custom interpret value attribute
        if ($this.attr(options.interpretValueAttr)) {
            try {
                // Eval the contents of the attribute
                var customInterpretValue = eval("0, " + /* <-- IE8 fix */ $this.attr(options.interpretValueAttr));
                // If the result is a function, execute it
                if (typeof (customInterpretValue) === "function") {
                    v = customInterpretValue.call($this, $context);
                    usedCustomInterpret = true;

                    // Put the resulting object into the correct format
                    if (v === null || typeof (v) !== "object" || (typeof (v.convertedValue) === "undefined" && typeof (v.rawValue) === "undefined"))
                        v = { rawValue: v, convertedValue: v };
                    else if (typeof (v.convertedValue) !== "undefined" && typeof (v.rawValue) === "undefined")
                        v = { rawValue: v.convertedValue, convertedValue: v.convertedValue };
                    else if (typeof (v.convertedValue) === "undefined" && typeof (v.rawValue) !== "undefined")
                        v = { rawValue: v.rawValue, convertedValue: v.rawValue };

                    // If the result is fully interpreted (it has isMissing and isInvalid properties), we can finalize and return it
                    if (typeof (v.isMissing) !== "undefined" && typeof (v.isInvalid) !== "undefined") {
                        // Only compulsory fields can be missing
                        v.isMissing = v.isMissing && isCompulsory;

                        // Check validation rules
                        checkValidationRules.call($this, options, v);
                        return v;
                    }
                }
            }
            catch (err) {
                consoleLog(err);
            }
        }
        if (!usedCustomInterpret) {
            v = getValueFromElement(options, $this, $context);
        }

        v.isMissing = false;
        v.isInvalid = false;

        // Check if it's compulsory
        if (isCompulsory) {
            // If this is a checkbox or a radio group which has a group (name attribute), one of them must be checked.
            if ($this.is("input[type=checkbox],input[type=radio]") && $this.attr("name")) {
                var $others = $('input[type="' + $this.attr("type") + '"][name="' + $this.attr("name") + '"]', $context);
                v.isMissing = true;
                $others.each(function () {
                    var $other = $(this);
                    if ($other.is(":checked")) {
                        v.isMissing = false;
                    }
                });
            }
            // If this is a regular input element (input type text, select, textarea),
            // the only thing that needs to be checked is whether the value is an empty string
            else if (typeof (v.rawValue) === "undefined" || v.rawValue === "" || v.rawValue === null) {
                v.isMissing = true;
            }
        }

        // Check if its format is valid
        if ($this.attr(options.validateValueAttr)) {
            // Execute custom validator function, if there is one
            try {
                var validatorFunction = eval("0, " + /* <-- IE8 fix */ $this.attr(options.validateValueAttr));
                v.isInvalid = !validatorFunction.call($this, v.convertedValue);
            }
            catch (err) {
                consoleLog(err);
                v.isInvalid = true;
            }
        }
        else if ($this.attr(options.convertAttr)) {
            if (typeof (v.convertedValue) === "boolean" && $this.is("select,input[type=checkbox],input[type=radio]")) {
                v.isInvalid = false;
            }
            else if (String(v.convertedValue) !== String(v.rawValue)) {
                v.isInvalid = true;
            }
        }

        // Check validation rules
        checkValidationRules.call($this, options, v);

        return v;
    };

    // Shows the validation message for an element
    var showValidationMessage = function (options, $context) {
        var $this = $(this);
        var fieldName = $this.attr(options.fieldNameAttr);
        var $validationLabel = $("[" + options.validatorOfAttr + "='" + fieldName + "']", $context);
        var validation = interpretElement.call(this, options, $context);
        var validationMessage = "";

        if (validation.errorMessage) {
            validationMessage += " " + validation.errorMessage;
        }
        else {
            // Check if it's compulsory
            if (validation.isMissing) {
                validationMessage += " " + options.compulsoryMessage;
            }

            // Check if its format is valid
            if (validation.isInvalid) {
                validationMessage += " " + ($this.attr(options.customInvalidFormatMessageAttr) || options.invalidFormatMessage);
            }
        }


        // Toggle visibility of the validation label
        $validationLabel.html(validationMessage);
        $validationLabel.css("display", (!validation.isInvalid && !validation.isMissing) ? "none" : "block");

        return validation;
    };

    var isOkay = function () {
        return !this.invalidFields.length && !this.missingFields.length;
    };

    var focusInvalidField = function () {
        if (this.fieldToFocus) {
            this.fieldToFocus.focus();
        }
    };

    // Tosses values from elements with the specified attribute within the specified context into an object.
    $.fn.tossValues = function (options) {
        // Options
        options = $.extend({}, defaultOptions, options);

        // The resulting object
        var result = {
            obj: {},
            invalidFields: [],
            missingFields: [],
            isOkay: isOkay,
            onlyOneError: false,
            fieldToFocus: null,
            focusInvalidField: focusInvalidField
        };

        // Save the value of this (to be used in a closure)
        var $context = this;

        // For each element which represents a field, get its value and perform validation
        $("[" + options.fieldNameAttr + "]", $context).each(function () {
            var $this = $(this);

            // If we don't want to save this field, then don't
            if ($this.attr(options.dontSaveAttr))
                return;

            var key = $this.attr(options.fieldNameAttr);
            var v = interpretElement.call(this, options, $context);

            // Check if the field is missing
            if (v.isMissing) {
                result.missingFields.push(key);
                if (!result.fieldToFocus) {
                    result.onlyOneError = true;
                    result.fieldToFocus = $this;
                }
                else {
                    result.onlyOneError = false;
                }
            }
            // Check if the field is invalid (if it's missing we don't care)
            else if (v.isInvalid) {
                result.invalidFields.push(key);
                if (!result.fieldToFocus) {
                    result.onlyOneError = true;
                    result.fieldToFocus = $this;
                }
                else {
                    result.onlyOneError = false;
                }
            }

            // Array creation magic
            if ($this.attr(options.createArrayAttr) == "true") {
                if (!result.obj[key]) {
                    result.obj[key] = [];
                }
                if (v.convertedValue !== null) {
                    result.obj[key].push(v.convertedValue);
                }
            }
            else if (!result.obj[key] || v.convertedValue !== null) {
                result.obj[key] = v.convertedValue;
            }
        });

        // If specified, focus the errored field
        if (options.autoFocusErroredField)
            result.focusInvalidField();

        return result;
    };

    // Performs immediate field validation for elements under the specified context
    $.fn.validateValues = function (options) {
        // Options
        options = $.extend({}, defaultOptions, options);

        // Remember this (to be able to use it in a closure)
        var $context = this;

        $("[" + options.fieldNameAttr + "]", this).each(function () {
            showValidationMessage.call(this, options, $context);
        });

        // Return this (for chainability)
        return this;
    };

    // Adds a programmatic validation rule to an element
    $.fn.addValidationRule = function (func, options) {
        // Options
        options = $.extend({}, defaultOptions, options);

        // Remember this (to be able to use it in a closure)
        var $context = this;
        
        // Check parameters
        if (!func || typeof(func) !== "function")
            $.error("addValidationRule: first parameter must be a function");

        // Get rules
        var rules = $context.data(options.validationRulesKey) || [];
        if (typeof (rules.push) !== "function")
            rules = [];

        // Save
        rules.push(func);
        $context.data(options.validationRulesKey, rules);

        // Return this (for chainability)
        return this;
    };

    // Enables automatic validation for elements under the specified context
    $.fn.enableValueValidation = function (options) {
        // Options
        options = $.extend({}, defaultOptions, options);

        // Remember this (to be able to use it in a closure)
        var $context = this;

        // Hook up event handlers to each element's change event
        var $controls = $("[" + options.fieldNameAttr + "]", this);
        $controls.each(function () {
            var $this = $(this);
            var validationFunc = function () {
                // Always validate every control
                // NOTE: this is needed because validation results can depend on each other
                $controls.each(function () {
                    showValidationMessage.call($(this), options, $context);
                })
            };

            $this.on("change.tossvalues", validationFunc);

            if ($this.is("input[type=text], input[type=password], textarea") && options.autoValidationOnKeyup) {
                $this.on("keyup.tossvalues", validationFunc);
            }
        });

        // Return this (for chainability)
        return this;
    };

    $.fn.fillValues = function (options) {
        var $context = this;
        if (!options.obj) {
            // If the fill object is not specified, interpret the argument as the fill object itself
            options = { obj: options };
        }
        options = $.extend({}, defaultOptions, options);

        for (var prop in options.obj) {
            if (options.obj.hasOwnProperty(prop)) {
                $("[" + options.fieldNameAttr + "=\"" + prop + "\"]", $context).each(function () {
                    var $control = $(this);
                    var theValue = options.obj[prop];

                    // Ignore non-existent controls
                    if ($control.length === 0)
                        return;

                    $control.data("originalValue", theValue);

                    var customFill = null;
                    try {
                        customFill = eval("0, " + /* <-- IE8 fix */ $control.attr(options.customFillValueAttr));
                    }
                    catch (err) {
                        consoleLog("Trouble when evaling:", $control, options.customFillValueAttr, err);
                    }

                    if (typeof (customFill) === "function") {
                        customFill.call($control, theValue);
                    }
                    else if ($control.attr(options.interpretValueAttr)) {
                        // This element has custom interpretation which means we can't fill its value here
                        consoleLog("Can't fill value for field because the control has custom interpret value attribute.", $control, prop);
                    }
                    else if ($control.is("input[type=checkbox], input[type=radio]")) {
                        // Check box and radio button
                        if (typeof (theValue) === "boolean") {
                            // Boolean value - just check the box if true
                            $control.prop("checked", theValue);
                        }
                        else if (theValue && theValue.constructor === Array) {
                            // Array value- check the box if the array contains its value
                            $control.prop("checked", theValue.indexOf($control.attr("value")) >= 0);
                        }
                        else {
                            // Other value - check the box if its value matches the value
                            $control.prop("checked", $control.attr("value") == theValue);
                        }
                    }
                    else if ($control.is("input, textarea, select")) {
                        // Textboxes and selects
                        if (theValue && theValue.constructor === Array) {
                            $control.val(theValue[0]);
                        }
                        else if (theValue && theValue.constructor === Number) {
                            $control.val(theValue.toString());
                        }
                        else {
                            $control.val(theValue);
                        }
                        // TODO: take care of multiple selects?
                    }
                    else {
                        // Other kinds of elements
                        if (theValue && theValue.constructor === Array) {
                            $control.html(theValue[0]);
                        }
                        else if (theValue && theValue.constructor === Number) {
                            $control.html(theValue.toString());
                        }
                        else {
                            $control.html(theValue);
                        }
                    }

                    $control.trigger("change");
                });
            }
        }

        // Return this (for chainability)
        return this;
    };

    // Global object for user-configurable settings
    $.tossValues = $.tossValues || {};

    // Specifies if console logging is enabled (turn off when there is no console or console.log)
    $.tossValues.consoleLogEnabled = typeof (console) !== "undefined" && typeof (console.log) === "function";

    // Provides a way to customize the default options
    $.tossValues.setDefaultOptions = function (newDefaultOptions) {
        defaultOptions = $.extend({}, defaultOptions, newDefaultOptions);
    };

})(jQuery);
