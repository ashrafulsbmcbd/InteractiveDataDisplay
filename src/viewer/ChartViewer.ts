/// <reference path="ChartViewerControl.ts" />

module InteractiveDataDisplay {
    export interface ViewState {
        [name: string]: any;
    }
    export interface Titles {
        [seriesName: string]: string;
    }
    export interface PlotInfo {
        kind: string;
        displayName: string;
        titles?: Titles;
        [propertyName: string]: any;

    }
    export interface ChartInfo {
        [id: string]: PlotInfo;
    }
    export interface PropertyTitles {
        [prop: string]: string;
    }
    export interface ViewerControl {
        update(plots: ChartInfo);
        viewState: ViewState;
        dispose(): void;
    }

    export function ProbesVM(initialProbes) {
        var that = this;

        var lastUsedProbeIndex = 0;

        var _callbacks = [];
        var _probes = [];

        var raiseProbeUpdated = function (probe, status) {
            if (_callbacks.length > 0) {
                for (var i = 0; i < _callbacks.length; i++) {
                    _callbacks[i]({ probe: probe, status: status });
                }
            }
        }

        this.subscribe = function (callback) {
            _callbacks.push(callback);
        }

        this.clear = function () {
            var probesToRemove = _probes.slice(0);
            for (var i = 0; i < probesToRemove.length; i++) {
                that.removeProbe(probesToRemove[i].id);
            }
        }

        this.addProbe = function (plotCoord) {
            var newProbe = { id: ++lastUsedProbeIndex, location: plotCoord, selected: false };
            _probes.push(newProbe);
            raiseProbeUpdated(newProbe, "add");

            return newProbe.id;
        }

        this.removeProbe = function (id) {

            var probeToRemove = undefined;
            for (var i = 0; i < _probes.length; i++) {
                var probe = _probes[i];
                if (probe.id == id) {
                    probeToRemove = probe;
                    break;
                }
            }

            if (probeToRemove !== undefined) {
                _probes = _probes.filter(function (p) { return p !== probeToRemove });
                raiseProbeUpdated(probeToRemove, "remove");
            }

        }

        this.updateProbe = function (id, plotCoord) {

            var probeToUpdate = undefined;
            for (var i = 0; i < _probes.length; i++) {
                var probe = _probes[i];
                if (probe.id == id) {
                    probeToUpdate = probe;
                    break;
                }
            }

            if (probeToUpdate !== undefined) {
                probeToUpdate.location = plotCoord;
                raiseProbeUpdated(probeToUpdate, "update");
            }

        }

        this.selectProbe = function (id) {

            if (id === -1) {
                for (var i = 0; i < _probes.length; i++) {
                    var probe = _probes[i];
                    probe.selected = false;
                }
                raiseProbeUpdated(undefined, "unselected");
                return;
            }

            var selectedProbe = undefined;
            for (var i = 0; i < _probes.length; i++) {
                var probe = _probes[i];
                if (probe.id == id) {
                    selectedProbe = probe;
                    selectedProbe.selected = true;
                } else {
                    probe.selected = false;
                }
            }

            if (selectedProbe !== undefined) {
                raiseProbeUpdated(selectedProbe, "selected");
            }
        }

        this.fitToProbe = function (id) {
            var selectedProbe = undefined;
            for (var i = 0; i < _probes.length; i++) {
                var probe = _probes[i];
                if (probe.id == id) {
                    selectedProbe = probe;
                    raiseProbeUpdated(selectedProbe, "fit");
                }
            }

        }

        this.getProbes = function () {
            return _probes.slice(0);
        }

        this.getProbeContent = function (probe) {
            return undefined;
        }

        this.refresh = function () {
            if (that.onRefresh !== undefined) {
                that.onRefresh(_probes.slice(0));
            }
        }

        if (initialProbes !== undefined) {
            for (var i = 0; i < initialProbes.length; i++) {
                var newProbe = { id: initialProbes[i].id, location: { x: initialProbes[i].location.x, y: initialProbes[i].location.y }, selected: initialProbes[i].selected };

                _probes.push(newProbe);

                if (newProbe.id > lastUsedProbeIndex)
                    lastUsedProbeIndex = newProbe.id;
            }
        }
    }

    export function ProbesControl(div, hostDiv, persistentViewState, transientViewState) {
        var probesVM = persistentViewState.probesViewModel;
        var _host = hostDiv;
        var probeDivs = [];
        var getProbeDiv = function (probe) {
            div[0].style.display = "block";
            var probeDiv = $("<div></div>").addClass("probeCard");

            if (probe.selected === true) {
                probeDiv.addClass("probeCard-selected");
            }

            var iconScale = 0.6;
            var probeHeader = $("<div></div>").addClass("probeHeader").appendTo(probeDiv).height(40 * iconScale);
            var probeIcon = $("<div></div>").addClass("probe").css("float", "left").css("margin-right", 3).width(40 * iconScale).height(40 * iconScale).appendTo(probeHeader);
            if (probe.selected) {
                createSmallProbe(probeIcon, probe.id, "#365C95", iconScale);
            } else {
                createSmallProbe(probeIcon, probe.id, undefined, iconScale);
            }
            $("<div></div>").addClass("probeHeader-name").text(transientViewState.plotXFormatter.toString(probe.location.x) + ", " + transientViewState.plotYFormatter.toString(probe.location.y)).appendTo(probeHeader);

            var actionPanel = $("<div></div>").addClass("probeActionPanel").appendTo(probeDiv);
            var deleteBtn = $("<div></div>").addClass("probeCard-remove").appendTo(actionPanel);
            deleteBtn.click(function () {
                probesVM.removeProbe(probe.id);
                if (persistentViewState.uncertaintyRange !== undefined && persistentViewState.uncertaintyRange.probeid === probe.id) {
                    persistentViewState.uncertaintyRange = undefined;
                }
                if (hostDiv[0].childNodes.length == 0) hostDiv[0].style.display = "none";
            });

            var fitBtn = $("<div></div>").addClass("probeCard-fit").appendTo(actionPanel);
            fitBtn.click(function () {
                probesVM.fitToProbe(probe.id);
            });


            var tooltip = probesVM.getProbeContent(probe);
            if (tooltip !== undefined) {
                for (var i = 0; i < tooltip.length; i++) {
                    var tt = $(tooltip[i]);
                    tt.addClass("probecard-record");
                    tt.appendTo(probeDiv);
                }
            }
            return probeDiv;
        }

        var refresh = function (probes) {
            _host.empty();
            probeDivs = [];
            for (var i = 0; i < probes.length; i++) {
                var probe = probes[i];
                var probeDiv = getProbeDiv(probe);
                var probeHost = $("<div></div>").css("display", "inline").appendTo(_host);
                probeDiv.appendTo(probeHost);
                probeDivs.push({ id: probe.id, div: probeDiv, host: probeHost });
            }
            if (probes.length > 0) hostDiv[0].style.display = "block";
        }

        //creating view for existing probes
        refresh(probesVM.getProbes());

        probesVM.subscribe(function (args) {
            var probe = args.probe;
            switch (args.status) {
                case "add":
                    hostDiv[0].style.display = "block";
                    var probeDiv = getProbeDiv(args.probe);
                    var probeHost = $("<div></div>").css("display", "inline").appendTo(_host);
                    probeDiv.appendTo(probeHost);
                    probeDivs.push({ id: probe.id, div: probeDiv, host: probeHost });
                    break;
                case "remove":
                    for (var i = 0; i < probeDivs.length; i++) {
                        var pDiv = probeDivs[i];
                        if (pDiv.id === probe.id) {
                            pDiv.host.remove();
                            probeDivs = probeDivs.filter(function (d) { return d.id !== probe.id });
                            if (hostDiv[0].childNodes.length == 0) hostDiv[0].style.display = "none";
                            break;
                        }
                    }
                    break;
                case "update":
                    for (var i = 0; i < probeDivs.length; i++) {
                        var pDiv = probeDivs[i];
                        if (pDiv.id === probe.id) {
                            pDiv.host.empty();
                            var probeDiv = getProbeDiv(args.probe);
                            probeDiv.appendTo(pDiv.host);
                            pDiv.div = probeDiv;
                            break;
                        }
                    }
                    break;
                case "selected":
                    refresh(probesVM.getProbes());
                    break;
                case "unselected":
                    refresh(probesVM.getProbes());
                    break;
            }
        });

        probesVM.onRefresh = function (probes) {
            refresh(probes);
        }
    }
    
    export function show(domElement: HTMLElement, plots: ChartInfo, viewState?: ViewState): InteractiveDataDisplay.ViewerControl {
        if (viewState) throw "viewState argument is not supported";
        var control = new ChartViewerControl(domElement);
        control.update(plots);
        return control;
    }

    //necessary functions and classes from idd
    export declare function NavigationPanel(plot, div, url?);
    export declare function asPlot(div): any;
    export declare var CanvasPlot: any;
    export declare var mercatorTransform: any;
    export declare var Utils: any;
    export declare class Area {
        constructor(div, master);
    }
    export declare class Heatmap {
        constructor(div, master);
    }
    export declare class Markers {
        constructor(div, master);
    }
    export declare class Polyline {
        constructor(div, master);
    }
    export declare class BingMapsPlot {
        constructor(div, master);
        order;
    }
    export declare class DOMPlot {
        constructor(host, master);
        order;
        domElements;
        master;
        host;
        coordinateTransform;
        add(element, scaleMode, x, y, width, height, originX, originY);
        remove(element);
    }
    export declare class AdaptiveFormatter {
        constructor(series, segment?);
    }
    export declare class Legend {
        constructor(_plot, _jqdiv, isCompact?, hasTooltip?);
        remove();
    }
}