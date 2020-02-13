import * as React from 'react';

import OlMap from 'ol/Map';
import OlLayerBase from 'ol/layer/Base';
import OlLayerBaseImage from 'ol/layer/BaseImage';
import OlLayerBaseTile from 'ol/layer/BaseTile';
import OlSourceImageWMS from 'ol/source/ImageWMS';
import OlSourceTileWMS from 'ol/source/TileWMS';
import OlFormatGeoJSON from 'ol/format/GeoJSON';
import OlMapBrowserEvent from 'ol/MapBrowserEvent';
import OlFeature from 'ol/Feature';

import _cloneDeep from 'lodash/cloneDeep';

import UrlUtil from '@terrestris/base-util/dist/UrlUtil/UrlUtil';
import Logger from '@terrestris/base-util/dist/Logger';

import './CoordinateInfo.less';
import { FeatureCollection } from 'geojson';

const format = new OlFormatGeoJSON();

interface DefaultProps {
  /**
   * List of (WMS) layers that should be queried.
   */
  queryLayers: Array<OlLayerBaseImage | OlLayerBaseTile>;

  /**
   * The number of max. features that should be returned by the GFI request.
   */
  featureCount: number;

  /**
   * Whether the GFI control should requests all layers at a given coordinate
   * or just the uppermost one.
   */
   drillDown: boolean;

   /**
    * Hit-detection tolerance in pixels. Pixels inside the radius around the
    * given position will be checked for features.
    */
   hitTolerance: number;

   /**
    * The children component that should be rendered. The render prop function
    * receives the state of the component (this is the clicked coordinate, the
    * list of GFI features if any and the loading state).
    */
   resultRenderer: (childrenProps: CoordinateInfoState) => React.ReactNode;
}

interface BaseProps {
    /**
     * The ol map.
     */
    map: OlMap;
}

interface CoordinateInfoState {
  clickCoordinate: [number, number] | null;
  features: object;
  loading: boolean;
}

export type CoordinateInfoProps = BaseProps & Partial<DefaultProps>;

/**
 * Constructs a wrapper component for querying features from the clicked
 * coordinate. The returned features can be passed to a child component
 * to be visualized.
 *
 * @class The CoordinateInfo
 * @extends React.Component
 */
export class CoordinateInfo extends React.Component<CoordinateInfoProps, CoordinateInfoState> {
  /**
   * The defaultProps.
   */
  static defaultProps: DefaultProps = {
    queryLayers: [],
    featureCount: 1,
    drillDown: true,
    hitTolerance: 5,
    resultRenderer: () => {
      return (
        <div></div>
      );
    }
  };

  /**
   * Creates the CoordinateInfo component.
   * @constructs CoordinateInfo
   */
  constructor(props: CoordinateInfoProps) {
    super(props);

    this.state = {
      clickCoordinate: null,
      features: [],
      loading: false
    };

    this.onMapClick = this.onMapClick.bind(this);
    this.layerFilter = this.layerFilter.bind(this);
  }

  componentDidMount() {
    const {
      map
    } = this.props;

    map.on('click', this.onMapClick);
  }

  componentWillUnmount() {
    const {
      map
    } = this.props;

    map.un('click', this.onMapClick);
  }

  onMapClick(olEvt: OlMapBrowserEvent) {
    const {
      map,
      featureCount,
      drillDown,
      hitTolerance
    } = this.props;

    const mapView = map.getView();
    const viewResolution = mapView.getResolution();
    const viewProjection = mapView.getProjection();
    const pixel = map.getEventPixel(olEvt.originalEvent);
    const coordinate = olEvt.coordinate;

    let featureInfoUrls = [];

    map.forEachLayerAtPixel(pixel, (layer: OlLayerBase) => {
      const layerSource = layer.getSource();
      const featureInfoUrl = layerSource.getFeatureInfoUrl(
        coordinate,
        viewResolution,
        viewProjection,
        {
          'INFO_FORMAT': 'application/json',
          'FEATURE_COUNT': featureCount
        }
      );

      featureInfoUrls.push(featureInfoUrl);

      if (!drillDown) {
        return true;
      }

      return false;
    }, {
      layerFilter: this.layerFilter,
      hitTolerance: hitTolerance
    });

    const combinedFeatureInfoUrls = UrlUtil.bundleOgcRequests(featureInfoUrls, true);

    let promises = [];
    Object.keys(combinedFeatureInfoUrls).forEach((key: string) => {
      promises.push(fetch(combinedFeatureInfoUrls[key]));
    });

    map.getTargetElement().style.cursor = 'wait';

    this.setState({
      loading: true
    });

    Promise.all(promises)
      .then((responses: Response[]) => {
        this.setState({
          clickCoordinate: coordinate
        });
        const jsons = responses.map(response => response.json());
        return Promise.all(jsons);
      })
      .then((featureCollections: FeatureCollection[]) => {
        let features = {};

        featureCollections.forEach((featureCollection: FeatureCollection) => {
          const fc = format.readFeatures(featureCollection);
          fc.forEach((feature: OlFeature) => {
            const featureTypeName = feature.getId().split('.')[0];

            if (!features[featureTypeName]) {
              features[featureTypeName] = [];
            }

            features[featureTypeName].push(feature);
          });
        });
        this.setState({
          features: features
        });
      })
      .catch((error: Error) => {
        Logger.error(error);
      })
      .finally(() => {
        map.getTargetElement().style.cursor = '';

        this.setState({
          loading: false
        });
      });
  }

  layerFilter(layerCandidate: OlLayerBase) {
    const {
      queryLayers
    } = this.props;

    const source = layerCandidate.getSource();
    const isWms = source instanceof OlSourceImageWMS || source instanceof OlSourceTileWMS;

    return isWms && queryLayers.includes(layerCandidate);
  }

  render () {
    const {
      resultRenderer
    } = this.props;

    return(
      <>
        {resultRenderer(_cloneDeep(this.state))}
      </>
    );
  }
}

export default CoordinateInfo;
