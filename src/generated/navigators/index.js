import testnav, {navEditors as testnavNavEditors} from "/Users/admin/Documents/Builds/apptileseed/apptile-seed/src/navigators/testnav/source/index";
import maintabs, {navEditors as maintabsNavEditors} from "/Users/admin/Documents/Builds/apptileseed/apptile-seed/src/navigators/maintabs/source/index";


export default [
  { creator: maintabs, name: "maintabs", navEditors: maintabsNavEditors },
  { creator: testnav, name: "testnav", navEditors: testnavNavEditors },
]