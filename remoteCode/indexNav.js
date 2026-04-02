// This file is generated. Do not edit.
import testnav, {navEditors as testnavNavEditors} from "./navigators/testnav/source/index";
import {registerCreator} from 'apptile-core';
export const navs = [
  {creator: testnav, name: "testnav", navEditors: testnavNavEditors},
];

export function initNavs() {
  for (let nav of navs) {
    registerCreator(nav.name, nav.creator, nav.navEditors);
  }
}
  