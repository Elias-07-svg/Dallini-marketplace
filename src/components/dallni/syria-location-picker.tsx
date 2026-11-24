import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DALLNI_COLORS } from '@/components/dallni/flow-ui';
import {
  formatSyriaLocation,
  getSyriaLocation,
  getSyriaLocationChildren,
  getSyriaLocationPath,
  searchSyriaLocalities,
  SYRIA_LOCATION_LEVEL_LABELS,
  type SyriaLocation,
} from '@/utils/syria-locations';

type SyriaLocationPickerProps = {
  label: string;
  value: string;
  onChange: (locationId: string) => void;
  disabled?: boolean;
};

export function SyriaLocationPicker(props: SyriaLocationPickerProps) {
  return <SyriaLocationPickerForm key={props.value} {...props} />;
}

function SyriaLocationPickerForm({ label, value, onChange, disabled = false }: SyriaLocationPickerProps) {
  const selectedPath = getSyriaLocationPath(value);
  const [isOpen, setIsOpen] = useState(false);
  const [governorateId, setGovernorateId] = useState(() => selectedPath.find((location) => location.level === 'governorate')?.id ?? '');
  const [districtId, setDistrictId] = useState(() => selectedPath.find((location) => location.level === 'district')?.id ?? '');
  const [subdistrictId, setSubdistrictId] = useState(() => selectedPath.find((location) => location.level === 'subdistrict')?.id ?? '');
  const [localityId, setLocalityId] = useState(() => selectedPath.find((location) => location.level === 'locality')?.id ?? '');
  const [localitySearch, setLocalitySearch] = useState('');

  const districts = getSyriaLocationChildren(governorateId).filter((item) => item.level === 'district');
  const subdistricts = getSyriaLocationChildren(districtId).filter((item) => item.level === 'subdistrict');
  const localities = subdistrictId ? searchSyriaLocalities(subdistrictId, localitySearch) : [];

  function chooseLocation(location: SyriaLocation) {
    onChange(location.id);
    setIsOpen(false);
  }

  function chooseGovernorate(id: string) {
    setGovernorateId(id);
    setDistrictId('');
    setSubdistrictId('');
    setLocalityId('');
  }

  function chooseDistrict(id: string) {
    setDistrictId(id);
    setSubdistrictId('');
    setLocalityId('');
  }

  function chooseSubdistrict(id: string) {
    setSubdistrictId(id);
    setLocalityId('');
    setLocalitySearch('');
  }

  const selectedGovernorate = getSyriaLocation(governorateId);
  const selectedDistrict = getSyriaLocation(districtId);
  const selectedSubdistrict = getSyriaLocation(subdistrictId);
  const selectedLocality = getSyriaLocation(localityId);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || false, expanded: isOpen }}
        disabled={disabled}
        onPress={() => setIsOpen((current) => !current)}
        style={({ pressed }) => [styles.selected, pressed && !disabled && styles.pressed]}>
        <Text style={[styles.selectedValue, !value && styles.placeholder]}>{formatSyriaLocation(value)}</Text>
        <Text style={styles.changeText}>{isOpen ? 'إخفاء' : 'اختيار'}</Text>
      </Pressable>

      {isOpen && !disabled ? (
        <View style={styles.picker}>
          <Text style={styles.stepLabel}>١. اختر المحافظة</Text>
          <View style={styles.options}>
            {getSyriaLocationChildren().map((governorate) => (
              <LocationOption
                key={governorate.id}
                location={governorate}
                selected={governorateId === governorate.id}
                onPress={() => chooseGovernorate(governorate.id)}
              />
            ))}
          </View>
          {selectedGovernorate ? (
            <>
              <CommitLocationButton location={selectedGovernorate} onPress={() => chooseLocation(selectedGovernorate)} />
              <Text style={styles.stepLabel}>٢. اختر المدينة أو المنطقة</Text>
              <View style={styles.options}>
                {districts.map((district) => (
                  <LocationOption
                    key={district.id}
                    location={district}
                    selected={districtId === district.id}
                    onPress={() => chooseDistrict(district.id)}
                  />
                ))}
              </View>
            </>
          ) : null}
          {selectedDistrict ? (
            <>
              <CommitLocationButton location={selectedDistrict} onPress={() => chooseLocation(selectedDistrict)} />
              <Text style={styles.stepLabel}>٣. اختر الناحية</Text>
              <View style={styles.options}>
                {subdistricts.map((subdistrict) => (
                  <LocationOption
                    key={subdistrict.id}
                    location={subdistrict}
                    selected={subdistrictId === subdistrict.id}
                    onPress={() => chooseSubdistrict(subdistrict.id)}
                  />
                ))}
              </View>
            </>
          ) : null}
          {selectedSubdistrict ? (
            <>
              <CommitLocationButton location={selectedSubdistrict} onPress={() => chooseLocation(selectedSubdistrict)} />
              <Text style={styles.stepLabel}>٤. ابحث عن بلدة أو قرية</Text>
              <TextInput
                accessibilityLabel="ابحث عن بلدة أو قرية سورية"
                autoCorrect={false}
                onChangeText={setLocalitySearch}
                placeholder="اكتب اسم البلدة أو القرية"
                placeholderTextColor={DALLNI_COLORS.muted}
                style={styles.searchInput}
                textAlign="right"
                value={localitySearch}
              />
              {selectedLocality ? (
                <CommitLocationButton location={selectedLocality} onPress={() => chooseLocation(selectedLocality)} />
              ) : null}
              <View style={styles.options}>
                {localities.map((locality) => (
                  <LocationOption
                    key={locality.id}
                    location={locality}
                    selected={localityId === locality.id}
                    onPress={() => setLocalityId(locality.id)}
                  />
                ))}
              </View>
              {localitySearch.trim() && localities.length === 0 ? (
                <Text style={styles.emptyText}>ما لقينا بلدة أو قرية بهالاسم ضمن الناحية المختارة.</Text>
              ) : null}
            </>
          ) : null}
          <Text style={styles.hint}>
            اختر المحافظة، ثم المدينة أو المنطقة، والناحية، والبلدة أو القرية. فيك تعتمد أي مستوى حسب نطاق الخدمة.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function LocationOption({ location, selected, onPress }: { location: SyriaLocation; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}>
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{location.name}</Text>
    </Pressable>
  );
}

function CommitLocationButton({ location, onPress }: { location: SyriaLocation; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.commitButton, pressed && styles.pressed]}>
      <Text style={styles.commitText}>اعتماد {SYRIA_LOCATION_LEVEL_LABELS[location.level]}: {location.name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { color: DALLNI_COLORS.ink, fontSize: 12, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  selected: { alignItems: 'center', backgroundColor: '#F5F8F6', borderColor: DALLNI_COLORS.border, borderRadius: 13, borderWidth: 1, flexDirection: 'row-reverse', gap: 8, justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 12, paddingVertical: 9 },
  selectedValue: { color: DALLNI_COLORS.ink, flex: 1, fontSize: 12, lineHeight: 19, textAlign: 'right', writingDirection: 'rtl' },
  placeholder: { color: DALLNI_COLORS.muted },
  changeText: { color: DALLNI_COLORS.green, fontSize: 11, fontWeight: '900' },
  picker: { backgroundColor: '#FAFCFB', borderColor: DALLNI_COLORS.border, borderRadius: 14, borderWidth: 1, gap: 9, padding: 10 },
  stepLabel: { color: DALLNI_COLORS.ink, fontSize: 11, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  options: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  option: { backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 12, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7 },
  optionSelected: { backgroundColor: '#E5F4EB', borderColor: DALLNI_COLORS.green },
  optionText: { color: DALLNI_COLORS.ink, fontSize: 10, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  optionTextSelected: { color: DALLNI_COLORS.greenDark, fontWeight: '900' },
  commitButton: { alignItems: 'flex-end', backgroundColor: '#EDF6F0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  commitText: { color: DALLNI_COLORS.greenDark, fontSize: 10, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  searchInput: { backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 11, borderWidth: 1, color: DALLNI_COLORS.ink, fontSize: 12, minHeight: 42, paddingHorizontal: 11, textAlign: 'right', writingDirection: 'rtl' },
  emptyText: { color: DALLNI_COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: 'right', writingDirection: 'rtl' },
  hint: { color: DALLNI_COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: 'right', writingDirection: 'rtl' },
  pressed: { opacity: 0.72 },
});
