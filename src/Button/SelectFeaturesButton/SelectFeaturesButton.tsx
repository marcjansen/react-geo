import * as React from 'react';
import { useEffect, useRef, useState } from 'react';

import OlInteractionSelect, { Options as OlSelectOptions, SelectEvent as OlSelectEvent } from 'ol/interaction/Select';
import { StyleLike as OlStyleLike } from 'ol/style/Style';
import OlVectorLayer from 'ol/layer/Vector';
import OlVectorSource from 'ol/source/Vector';
import OlGeometry from 'ol/geom/Geometry';
import OlCollection from 'ol/Collection';
import OlFeature from 'ol/Feature';
import * as OlEventConditions from 'ol/events/condition';
import { unByKey } from 'ol/Observable';

import ToggleButton, { ToggleButtonProps } from '../ToggleButton/ToggleButton';
import { useMap } from '../../Hook/useMap';
import { DigitizeUtil } from '../../Util/DigitizeUtil';
import { CSS_PREFIX } from '../../constants';

interface OwnProps {
  /**
   * Select style of the selected features.
   */
  selectStyle?: OlStyleLike;
  /**
   * Additional configuration object to apply to the ol.interaction.Select.
   * See https://openlayers.org/en/latest/apidoc/module-ol_interaction_Select-Select.html
   * for more information
   *
   * Note: The keys condition, hitTolerance and style are handled internally
   *       and shouldn't be overwritten without any specific cause.
   */
  selectInteractionConfig?: OlSelectOptions;
  /**
   * The className which should be added.
   */
  className?: string;
  /**
   * Listener function for the 'select' event of the ol.interaction.Select
   * See https://openlayers.org/en/latest/apidoc/module-ol_interaction_Select.html
   * for more information.
   */
  onFeatureSelect?: (event: OlSelectEvent) => void;
  /**
   * Array of layers the SelectFeaturesButton should operate on.
   */
  layers: OlVectorLayer<OlVectorSource<OlGeometry>>[];
  /**
   * Hit tolerance of the select action. Default: 5
   */
  hitTolerance?: number;
  /**
   * Clear the feature collection of the interaction after select. Default: false
   */
  clearAfterSelect?: boolean;
}

export type SelectFeaturesButtonProps = OwnProps & ToggleButtonProps;

/**
 * The className added to this component.
 */
const defaultClassName = `${CSS_PREFIX}selectbutton`;

const SelectFeaturesButton: React.FC<SelectFeaturesButtonProps> = ({
  selectStyle,
  selectInteractionConfig,
  className,
  onFeatureSelect,
  hitTolerance = 5,
  layers,
  onToggle,
  clearAfterSelect = false,
  ...passThroughProps
}) => {
  const [selectInteraction, setSelectInteraction] = useState<OlInteractionSelect>();
  const featuresCollection = useRef<OlCollection<OlFeature<OlGeometry>>|null>(null);

  const map = useMap();

  useEffect(() => {
    if (!map) {
      return undefined;
    }

    if (featuresCollection.current === null) {
      featuresCollection.current = new OlCollection();
    }

    const selectInteractionName = 'react-geo-select-interaction';

    const newInteraction = new OlInteractionSelect({
      condition: OlEventConditions.singleClick,
      features: featuresCollection.current,
      hitTolerance: hitTolerance,
      style: selectStyle ?? DigitizeUtil.DEFAULT_SELECT_STYLE,
      layers: layers,
      ...(selectInteractionConfig ?? {})
    });

    newInteraction.set('name', selectInteractionName);
    newInteraction.setActive(false);

    map.addInteraction(newInteraction);

    setSelectInteraction(newInteraction);

    return () => {
      map.removeInteraction(newInteraction);
    };
  }, [layers, selectStyle, selectInteractionConfig, map, hitTolerance]);

  useEffect(() => {
    if (!selectInteraction) {
      return undefined;
    }

    const key = selectInteraction.on('select', e => {
      onFeatureSelect?.(e);
      if (clearAfterSelect) {
        featuresCollection.current.clear();
      }
    });

    return () => {
      unByKey(key);
    };
  }, [selectInteraction, onFeatureSelect, clearAfterSelect]);

  const onToggleInternal = (pressed: boolean, lastClickEvt: any) => {
    selectInteraction.setActive(pressed);
    onToggle?.(pressed, lastClickEvt);
    if (!pressed) {
      selectInteraction.getFeatures().clear();
    }
  };

  const finalClassName = className
    ? `${defaultClassName} ${className}`
    : defaultClassName;

  return <ToggleButton
    onToggle={onToggleInternal}
    className={finalClassName}
    {...passThroughProps}
  />;
};

export default SelectFeaturesButton;
